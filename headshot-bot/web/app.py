"""Веб-приложение: лендинг, страница бесплатного превью и API.

Переиспользует core/providers бота. Бесплатное превью — лидоген для
холодного трафика: одна генерация на IP в сутки, без хранения фото.
"""
import base64
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select

from config import load_settings
from core.db import init_db, make_engine, make_session_factory
from core.models import FreePreview
from core.packages import PACKAGES
from core.validation import validate_photo
from prompts.library import StyleLibrary
from providers.factory import make_provider

STATIC_DIR = Path(__file__).parent / "static"
FREE_LIMIT_PER_DAY = 1
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    engine = make_engine(settings.db_url)
    await init_db(engine)
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = make_session_factory(engine)
    app.state.provider = make_provider(settings)
    app.state.styles = StyleLibrary.load()
    yield
    await engine.dispose()


app = FastAPI(title="Деловой Портрет AI", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/styles")
async def api_styles(request: Request) -> list[dict]:
    return [{"key": s.key, "title": s.title} for s in request.app.state.styles.styles]


@app.get("/api/packages")
async def api_packages() -> list[dict]:
    return [
        {
            "code": p.code,
            "title": p.title,
            "price_rub": p.price_rub,
            "portraits": p.portraits,
            "styles": p.styles,
        }
        for p in PACKAGES.values()
    ]


@app.post("/api/free-preview")
async def free_preview(
    request: Request,
    photo: UploadFile = File(...),
    consent: str = Form(""),
) -> JSONResponse:
    if consent != "yes":
        return JSONResponse({"error": "consent_required"}, status_code=400)

    ip = request.client.host if request.client else "unknown"
    session_factory = request.app.state.session_factory
    since = datetime.now(timezone.utc) - timedelta(days=1)
    async with session_factory() as session:
        stmt = (
            select(func.count())
            .select_from(FreePreview)
            .where(FreePreview.ip == ip, FreePreview.created_at >= since)
        )
        used = (await session.execute(stmt)).scalar() or 0
    if used >= FREE_LIMIT_PER_DAY:
        return JSONResponse({"error": "daily_limit"}, status_code=429)

    data = await photo.read()
    if len(data) > MAX_UPLOAD_BYTES:
        return JSONResponse({"error": "too_large"}, status_code=413)
    check = validate_photo(data)
    if not check.ok:
        return JSONResponse({"error": check.reason}, status_code=422)

    try:
        image = await request.app.state.provider.teaser(
            data, request.app.state.styles.teaser_prompt
        )
    except Exception:
        return JSONResponse({"error": "generation_failed"}, status_code=502)

    # Фиксируем расход лимита только после успешной генерации; само фото
    # не сохраняем — приватность проще политики хранения.
    async with session_factory() as session:
        session.add(FreePreview(ip=ip))
        await session.commit()

    return JSONResponse(
        {"image": "data:image/jpeg;base64," + base64.b64encode(image).decode()}
    )


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/free")
async def free_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "free.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

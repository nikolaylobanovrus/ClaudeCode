"""Веб-приложение: лендинг + API. Переиспользует core/providers/worker бота.

Этап 1 — продающий лендинг и каталог образов (JSON).
Этап 2 — загрузка фото, конструктор фон×одежда, оплата ЮKassa.
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from core.packages import PACKAGES
from prompts.library import StyleLibrary

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="Деловой Портрет AI", docs_url=None, redoc_url=None)
_styles = StyleLibrary.load()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/styles")
async def api_styles() -> list[dict]:
    return [{"key": s.key, "title": s.title} for s in _styles.styles]


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


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

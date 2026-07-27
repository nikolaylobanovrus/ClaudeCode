"""Веб-приложение: лендинг, страница бесплатного превью и API.

Переиспользует core/providers бота. Бесплатное превью — лидоген для
холодного трафика: одна генерация на IP в сутки, без хранения фото.
"""
import asyncio
import base64
import logging
import re
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import aiohttp
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select

from config import load_settings
from core.db import init_db, make_engine, make_session_factory
from core.email import send_email
from core.models import FreePreview, Job, Photo, RemixTask, TeamLead, User, utcnow
from core.teams import team_quote
from core.packages import PACKAGES, RECOMMENDED_CODE, get_package
from core.payments import YooKassaClient, customer_from_contact
from core.states import JobState, validate_transition
from core.validation import validate_photo
from prompts.library import StyleLibrary
from prompts.wardrobe import WardrobeLibrary
from providers.factory import make_provider
from storage.files import FileStorage

STATIC_DIR = Path(__file__).parent / "static"
FREE_LIMIT_PER_DAY = 1

# INFO-логи наших модулей (тайминги оплаты/авторизации) в журнал uvicorn.
# basicConfig — no-op, если хендлеры уже настроены (например, в тестах).
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("web")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MIN_PHOTOS, MAX_PHOTOS = 10, 15


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
    app.state.wardrobe = WardrobeLibrary.load()
    app.state.storage = FileStorage(settings.data_dir / "files")
    app.state.payments = (
        YooKassaClient(settings.yookassa_shop_id, settings.yookassa_secret)
        if settings.yookassa_shop_id and settings.yookassa_secret
        else None
    )
    retention_task = asyncio.create_task(_retention_loop(app))
    yield
    retention_task.cancel()
    try:
        await retention_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()


async def _retention_loop(app: FastAPI) -> None:
    """Периодически удаляет исходные фото старше срока хранения (152-ФЗ)."""
    from core.retention import purge_expired

    settings = app.state.settings
    # Небольшая задержка перед первым проходом — не конкурируем с запуском.
    await asyncio.sleep(60)
    while True:
        try:
            await purge_expired(
                app.state.session_factory, app.state.storage, settings.retention_days
            )
        except Exception:
            pass  # ретеншн не должен ронять сервис
        await asyncio.sleep(6 * 3600)


app = FastAPI(title="Деловой Портрет AI", docs_url=None, redoc_url=None, lifespan=lifespan)

from web.admin import router as admin_router  # noqa: E402
from web.auth import current_account  # noqa: E402
from web.auth import router as auth_router  # noqa: E402

app.include_router(admin_router)
app.include_router(auth_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/styles")
async def api_styles(request: Request) -> list[dict]:
    return [{"key": s.key, "title": s.title} for s in request.app.state.styles.styles]


@app.get("/api/wardrobe")
async def api_wardrobe(request: Request, kind: str, gender: str = "male") -> JSONResponse:
    """Каталог для конструктора образов. kind=clothing|background.
    Одежда фильтруется по полу; фоны общие. Поиск/фильтр — на клиенте."""
    if kind not in ("clothing", "background"):
        return JSONResponse({"error": "bad_kind"}, status_code=422)
    wl: WardrobeLibrary = request.app.state.wardrobe
    if kind == "clothing":
        if gender not in ("male", "female"):
            return JSONResponse({"error": "bad_gender"}, status_code=422)
        items = wl.clothing(gender)
        base = "/static/img/wardrobe/clothing/"
    else:
        # Фоны общие, но превью — с моделью соответствующего пола (как HeadshotPro).
        g = gender if gender in ("male", "female") else "male"
        items = wl.backgrounds()
        base = f"/static/img/wardrobe/background/{g}/"
    return JSONResponse({
        "categories": wl.categories(kind, gender),
        "items": [
            {"key": it.key, "label": it.label, "category": it.category,
             "thumb": f"{base}{it.key}.jpg"}
            for it in items
        ],
    })


@app.get("/api/packages")
async def api_packages() -> list[dict]:
    return [
        {
            "code": p.code,
            "title": p.title,
            "price_rub": p.price_rub,
            "portraits": p.portraits,
            "styles": p.styles,
            "remixes": p.remixes,
            "recommended": p.code == RECOMMENDED_CODE,
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


# ---------- Веб-заказ (основной продукт) ----------


async def _job_by_token(request: Request, token: str) -> Job | None:
    async with request.app.state.session_factory() as session:
        stmt = select(Job).where(Job.access_token == token)
        return (await session.execute(stmt)).scalar_one_or_none()


async def _notify_admins(settings, text: str) -> None:
    """Уведомление админам в Telegram напрямую через Bot API (веб-процесс).

    Вызывать в фоне (asyncio.create_task) из клиентских путей: api.telegram.org
    бывает медленным, и клиент не должен ждать нашу нотификацию. Таймаут — чтобы
    фоновые задачи не копились при недоступном Telegram."""
    if not settings.bot_token or not settings.admin_tg_ids:
        return
    url = f"https://api.telegram.org/bot{settings.bot_token}/sendMessage"
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as http:
            for admin_id in settings.admin_tg_ids:
                await http.post(url, json={"chat_id": admin_id, "text": text})
    except Exception:
        pass  # уведомление не должно ломать заказ


# Живые фоновые нотификации: держим ссылки, чтобы задачи не собрал GC до конца.
_notify_tasks: set[asyncio.Task] = set()


def _notify_admins_bg(settings, text: str) -> None:
    """Отправить уведомление в фоне — ответ клиенту его не ждёт."""
    task = asyncio.get_running_loop().create_task(_notify_admins(settings, text))
    _notify_tasks.add(task)
    task.add_done_callback(_notify_tasks.discard)


@app.post("/api/team-lead")
async def team_lead(
    request: Request,
    company: str = Form(...),
    name: str = Form(...),
    contact: str = Form(...),
    headcount: int = Form(0),
    message: str = Form(""),
):
    if not (2 <= len(company.strip()) <= 200):
        return JSONResponse({"error": "bad_company"}, status_code=422)
    if not (2 <= len(name.strip()) <= 100):
        return JSONResponse({"error": "bad_name"}, status_code=422)
    if not (3 <= len(contact.strip()) <= 200):
        return JSONResponse({"error": "bad_contact"}, status_code=422)
    headcount = max(0, min(headcount, 100000))
    async with request.app.state.session_factory() as session:
        session.add(TeamLead(
            company=company.strip(), name=name.strip(), contact=contact.strip(),
            headcount=headcount, message=(message.strip() or None),
        ))
        await session.commit()
    _notify_admins_bg(
        request.app.state.settings,
        f"🏢 Заявка на команду: {company.strip()} — {headcount} чел.\n"
        f"Контакт: {name.strip()}, {contact.strip()}"
        + (f"\nКомментарий: {message.strip()}" if message.strip() else ""),
    )
    return {"ok": True}


@app.get("/api/team/quote")
async def team_quote_api(n: int = 1):
    """Расчёт командной цены по числу сотрудников (для кабинета)."""
    return team_quote(n)


@app.post("/api/team/checkout")
async def team_checkout(
    request: Request,
    mode: str = Form(...),
    headcount: int = Form(...),
    company: str = Form(""),
    inn: str = Form(""),
    kpp: str = Form(""),
    address: str = Form(""),
    name: str = Form(""),
    phone: str = Form(""),
    comment: str = Form(""),
):
    """B2B-заявка из кабинета: mode=invoice (запрос счёта с реквизитами) или
    mode=card (клиент нажал «Оплатить картой/СБП»). Шлём письмо в продажи и
    дублируем админам; оплата пока обрабатывается вручную."""
    account = await current_account(request)
    if account is None:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    if mode not in ("invoice", "card"):
        return JSONResponse({"error": "bad_mode"}, status_code=422)
    q = team_quote(headcount)
    settings = request.app.state.settings

    lines = [
        f"Сотрудников: {q['headcount']}",
        f"Цена за сотрудника: {q['per_seat']} ₽ (скидка {q['percent']}%)",
        f"Итого: {q['total']} ₽ (экономия {q['discount']} ₽)",
        f"Каждый сотрудник: {q['portraits_per_seat']} портретов, {q['styles_per_seat']} образов",
        f"Аккаунт клиента: {account.email}",
    ]
    if mode == "invoice":
        if len(company.strip()) < 2 or len(inn.strip()) < 5:
            return JSONResponse({"error": "bad_requisites"}, status_code=422)
        subject = f"B2B: запрос счёта — {company.strip()} ({q['headcount']} чел., {q['total']} ₽)"
        req = [x for x in (
            f"Организация: {company.strip()}",
            f"ИНН: {inn.strip()}" + (f"  КПП: {kpp.strip()}" if kpp.strip() else ""),
            f"Адрес: {address.strip()}" if address.strip() else "",
            f"Контакт: {name.strip()}, {phone.strip()}" if (name.strip() or phone.strip()) else "",
            f"Комментарий: {comment.strip()}" if comment.strip() else "",
        ) if x]
        body = "Заявка на счёт (B2B):\n\n" + "\n".join([*req, "", *lines])
        details = " | ".join(req)
    else:  # card
        subject = f"B2B: клиент нажал «Оплатить картой/СБП» ({q['headcount']} чел., {q['total']} ₽)"
        body = ("Клиент нажал «Оплатить картой/СБП» (B2B).\n"
                "→ Направить ему ссылку и QR для оплаты на email.\n\n" + "\n".join(lines))
        details = "нажал «Оплатить картой/СБП»"

    try:
        await send_email(settings, settings.sales_email, subject, body)
    except Exception:
        pass
    _notify_admins_bg(settings, "🏢 " + subject + "\n" + "\n".join(lines))

    async with request.app.state.session_factory() as session:
        session.add(TeamLead(
            account_id=account.id,
            company=(company.strip() or account.email),
            name=(name.strip() or account.email),
            contact=account.email,
            headcount=q["headcount"],
            mode=mode,
            total_rub=q["total"],
            message=f"[{mode}] {details}; итого {q['total']}₽",
        ))
        await session.commit()
    return {"ok": True, "mode": mode}


async def _start_payment(request: Request, job_id: int, pkg, token: str, contact: str):
    """Создаёт платёж ЮKassa для заказа и сохраняет payment_id. Возвращает
    ссылку на оплату или None (нет провайдера/сбой → ручной режим)."""
    settings = request.app.state.settings
    payments: YooKassaClient | None = request.app.state.payments
    if payments is None:
        return None
    try:
        payment = await payments.create_payment(
            amount_rub=pkg.price_rub,
            description=f"Деловые портреты — пакет «{pkg.title}», заказ #{job_id}",
            return_url=f"{settings.public_base_url}/app/order?t={token}",
            metadata={"job_id": str(job_id), "token": token},
            customer=customer_from_contact(contact or ""),
        )
    except Exception:
        return None
    if payment is None or not payment.confirmation_url:
        return None
    async with request.app.state.session_factory() as session:
        db_job = await session.get(Job, job_id)
        db_job.payment_id = payment.id
        await session.commit()
    return payment.confirmation_url


@app.post("/api/orders")
async def create_order(
    request: Request,
    package: str = Form(...),
    contact: str = Form(""),
    consent: str = Form(""),
    styles: str = Form(""),
    gender: str = Form(""),
    clothing: str = Form(""),
    backgrounds: str = Form(""),
):
    """Флоу: тариф → образы (пол → одежда → фон) → оплата → селфи → результат.

    Образы выбираются ДО оплаты, поэтому сохраняем их на заказе сразу (после
    редиректа в ЮKassa состояние фронта теряется). Заказ создаётся в
    awaiting_payment; после оплаты переходит в collecting (загрузка селфи),
    затем /generate запускает генерацию по выбранным пулам одежды/фона.

    Основной путь — конструктор (gender+clothing+backgrounds пулы). Поддержан и
    легаси-путь по готовым стилям (styles) для совместимости.
    """
    if consent != "yes":
        return JSONResponse({"error": "consent_required"}, status_code=400)
    # Email в селфи-первом флоу собираем на шаге оплаты (checkout), поэтому
    # при создании черновика он опционален; проверяем только если передан.
    c = contact.strip()
    if c and not (3 <= len(c) <= 200):
        return JSONResponse({"error": "bad_contact"}, status_code=422)
    try:
        pkg = get_package(package)
    except ValueError:
        return JSONResponse({"error": "bad_package"}, status_code=422)

    cl_keys = [s for s in clothing.split(",") if s]
    bg_keys = [s for s in backgrounds.split(",") if s]
    use_wardrobe = bool(cl_keys or bg_keys or gender)
    styles_csv = None
    gender_val = None
    clothing_csv = None
    background_csv = None

    if use_wardrobe:
        if gender not in ("male", "female"):
            return JSONResponse({"error": "bad_gender"}, status_code=422)
        wl = request.app.state.wardrobe
        try:
            wl.resolve("clothing", cl_keys, gender)
            wl.resolve("background", bg_keys)
        except ValueError:
            return JSONResponse({"error": "bad_wardrobe"}, status_code=422)
        if not cl_keys or not bg_keys:
            return JSONResponse({"error": "empty_pool"}, status_code=422)
        # Каждый пул: не более числа образов тарифа (не менее 1 — уже проверено).
        if len(cl_keys) > pkg.styles or len(bg_keys) > pkg.styles:
            return JSONResponse({"error": "pool_too_big"}, status_code=422)
        # Из пулов нужно собрать N уникальных образов (наряд+фон).
        if len(cl_keys) * len(bg_keys) < pkg.styles:
            return JSONResponse({"error": "pool_too_small"}, status_code=422)
        gender_val = gender
        clothing_csv = ",".join(cl_keys)
        background_csv = ",".join(bg_keys)
    else:
        lib = request.app.state.styles
        chosen = [s for s in styles.split(",") if s]
        try:
            lib.resolve(chosen)
        except ValueError:
            return JSONResponse({"error": "bad_styles"}, status_code=422)
        if len(chosen) != pkg.styles:
            return JSONResponse({"error": "styles_count"}, status_code=422)
        styles_csv = ",".join(chosen)

    # Селфи-первый флоу: создаём заказ-черновик сразу в COLLECTING, чтобы клиент
    # мог загрузить селфи ДО оплаты. Email и оплата — на шаге /checkout.
    # Если клиент вошёл в кабинет — привяжем заказ к аккаунту.
    account = await current_account(request)
    token = secrets.token_urlsafe(24)
    async with request.app.state.session_factory() as session:
        # Синтетический пользователь со строго отрицательным tg_id: веб-клиент
        # без Telegram (не 0 — иначе спутается с реальным пользователем).
        user = User(tg_id=-(secrets.randbits(46) + 1), consent_at=utcnow())
        session.add(user)
        await session.flush()
        job = Job(
            user_id=user.id, state=JobState.COLLECTING, channel="web",
            package_code=pkg.code, styles_csv=styles_csv,
            gender=gender_val, clothing_csv=clothing_csv, background_csv=background_csv,
            remixes_left=pkg.remixes,
            contact=(c or None), access_token=token,
            account_id=account.id if account else None,
        )
        session.add(job)
        await session.commit()
        job_id = job.id

    _notify_admins_bg(
        request.app.state.settings,
        f"📝 Новый веб-заказ #{job_id} (черновик): «{pkg.title}». "
        f"Клиент загружает селфи; оплата после.",
    )
    return {"token": token, "state": "collecting", "price_rub": pkg.price_rub}


async def _source_photo_count(request: Request, job_id: int) -> int:
    async with request.app.state.session_factory() as session:
        return (await session.execute(
            select(func.count()).select_from(Photo).where(
                Photo.job_id == job_id, Photo.kind == Photo.SOURCE))
        ).scalar() or 0


async def _confirm_paid(request: Request, job_id: int) -> str | None:
    """Оплата подтверждена: заказ с загруженными селфи → training (генерация
    стартует сразу), иначе → collecting (легаси «оплата вперёд»). Идемпотентно:
    срабатывает только из awaiting_payment. Возвращает целевое состояние или None."""
    photos = await _source_photo_count(request, job_id)
    target = JobState.TRAINING if photos >= MIN_PHOTOS else JobState.COLLECTING
    async with request.app.state.session_factory() as session:
        job = await session.get(Job, job_id)
        if job is None or JobState(job.state) is not JobState.AWAITING_PAYMENT:
            return None
        job.state = validate_transition(JobState(job.state), target)
        await session.commit()
    return target.value


@app.post("/api/orders/{token}/checkout")
async def checkout_order(request: Request, token: str, contact: str = Form("")):
    """Селфи-первый флоу: заказ уже в COLLECTING с загруженными селфи — здесь
    клиент указывает email и оплачивает. Требует ≥ MIN_PHOTOS фото. При заглушке
    оплаты сразу запускает генерацию; иначе создаёт платёж ЮKassa."""
    t0 = time.monotonic()
    job = await _job_by_token(request, token)
    if job is None or JobState(job.state) is not JobState.COLLECTING:
        return JSONResponse({"error": "order_not_found"}, status_code=404)
    try:
        pkg = get_package(job.package_code or "")
    except ValueError:
        return JSONResponse({"error": "bad_package"}, status_code=422)
    c = contact.strip()
    if c and not (3 <= len(c) <= 200):
        return JSONResponse({"error": "bad_contact"}, status_code=422)
    if (await _source_photo_count(request, job.id)) < MIN_PHOTOS:
        return JSONResponse({"error": "not_enough_photos"}, status_code=409)

    account = await current_account(request)
    settings = request.app.state.settings
    async with request.app.state.session_factory() as session:
        db_job = await session.get(Job, job.id)
        # Перечитываем состояние под сессией — защита от гонки двойного checkout.
        if JobState(db_job.state) is not JobState.COLLECTING:
            return JSONResponse({"error": "order_not_found"}, status_code=409)
        if c:
            db_job.contact = c
        if account:
            db_job.account_id = account.id
        db_job.state = validate_transition(JobState(db_job.state), JobState.AWAITING_PAYMENT)
        await session.commit()
    t_db = time.monotonic()

    # Заглушка оплаты: подтверждаем и сразу запускаем генерацию (фото уже есть).
    if settings.payment_stub:
        await _confirm_paid(request, job.id)
        _notify_admins_bg(
            settings,
            f"🧪 ТЕСТОВЫЙ веб-заказ #{job.id} (заглушка оплаты): «{pkg.title}», "
            f"контакт: {c}. Генерация запущена.",
        )
        return {"token": token, "paid": True, "stub": True, "price_rub": pkg.price_rub}

    url = await _start_payment(request, job.id, pkg, token, c)
    log.info("checkout #%s: подготовка %.0f мс, платёж ЮKassa %.0f мс, всего %.0f мс",
             job.id, (t_db - t0) * 1000, (time.monotonic() - t_db) * 1000,
             (time.monotonic() - t0) * 1000)
    if url:
        _notify_admins_bg(
            settings,
            f"💳 ВЕБ-заказ #{job.id} ждёт оплаты: «{pkg.title}» {pkg.price_rub} ₽, "
            f"контакт: {c}",
        )
        return {"token": token, "payment_url": url, "price_rub": pkg.price_rub}

    # Ручной режим (нет ключей ЮKassa): подтверждает админ.
    _notify_admins_bg(
        settings,
        f"Новый ВЕБ-заказ #{job.id}: пакет «{pkg.title}», контакт: {c}. "
        f"После оплаты подтвердить: /approve_{job.id}",
    )
    return {"token": token, "manual": True, "price_rub": pkg.price_rub}


@app.post("/api/orders/{token}/pay")
async def pay_order(request: Request, token: str):
    """Повторная оплата заказа, застрявшего в awaiting_payment (например,
    клиент бросил оплату и вернулся из кабинета). Создаёт новый платёж."""
    job = await _job_by_token(request, token)
    if job is None or JobState(job.state) is not JobState.AWAITING_PAYMENT:
        return JSONResponse({"error": "order_not_found"}, status_code=404)
    try:
        pkg = get_package(job.package_code or "")
    except ValueError:
        return JSONResponse({"error": "bad_package"}, status_code=422)

    settings = request.app.state.settings
    if settings.payment_stub:
        await _confirm_paid(request, job.id)
        return {"paid": True, "stub": True, "price_rub": pkg.price_rub}

    t0 = time.monotonic()
    url = await _start_payment(request, job.id, pkg, token, job.contact or "")
    log.info("repay #%s: платёж ЮKassa %.0f мс", job.id, (time.monotonic() - t0) * 1000)
    if url:
        return {"payment_url": url, "price_rub": pkg.price_rub}
    return {"manual": True, "price_rub": pkg.price_rub}


@app.post("/api/orders/{token}/photos")
async def upload_photo(request: Request, token: str, photo: UploadFile = File(...)):
    job = await _job_by_token(request, token)
    if job is None or JobState(job.state) is not JobState.COLLECTING:
        return JSONResponse({"error": "order_not_found"}, status_code=404)
    data = await photo.read()
    if len(data) > MAX_UPLOAD_BYTES:
        return JSONResponse({"error": "too_large"}, status_code=413)
    check = validate_photo(data)
    if not check.ok:
        return JSONResponse({"error": check.reason}, status_code=422)
    storage: FileStorage = request.app.state.storage
    async with request.app.state.session_factory() as session:
        stmt = select(func.count()).select_from(Photo).where(
            Photo.job_id == job.id, Photo.kind == Photo.SOURCE
        )
        existing = (await session.execute(stmt)).scalar() or 0
        if existing >= MAX_PHOTOS:
            return JSONResponse({"error": "limit"}, status_code=409)
        key = storage.put(f"jobs/{job.id}/{Photo.SOURCE}/{existing:02d}.jpg", data)
        session.add(Photo(job_id=job.id, kind=Photo.SOURCE, storage_key=key))
        await session.commit()
    return {"count": existing + 1, "min": MIN_PHOTOS, "max": MAX_PHOTOS}


@app.post("/api/orders/{token}/generate")
async def start_generation(request: Request, token: str, styles: str = Form("")):
    """Оплаченный заказ: запуск генерации после загрузки селфи (collecting →
    training). Образы уже выбраны при оформлении; styles можно не передавать
    (берём сохранённые). Если переданы — валидируем и обновляем."""
    job = await _job_by_token(request, token)
    if job is None or JobState(job.state) is not JobState.COLLECTING:
        return JSONResponse({"error": "order_not_found"}, status_code=404)
    try:
        pkg = get_package(job.package_code or "")
    except ValueError:
        return JSONResponse({"error": "bad_package"}, status_code=422)
    # Заказ-конструктор (одежда/фон уже сохранены при оформлении) — стили не нужны.
    if not (job.clothing_csv and job.background_csv):
        lib = request.app.state.styles
        # По умолчанию — образы, выбранные при оформлении заказа.
        chosen = [s for s in (styles or job.styles_csv or "").split(",") if s]
        try:
            lib.resolve(chosen)
        except ValueError:
            return JSONResponse({"error": "bad_styles"}, status_code=422)
        if len(chosen) != pkg.styles:
            return JSONResponse({"error": "styles_count"}, status_code=422)

    async with request.app.state.session_factory() as session:
        stmt = select(func.count()).select_from(Photo).where(
            Photo.job_id == job.id, Photo.kind == Photo.SOURCE
        )
        if ((await session.execute(stmt)).scalar() or 0) < MIN_PHOTOS:
            return JSONResponse({"error": "not_enough_photos"}, status_code=409)
        db_job = await session.get(Job, job.id)
        # Перечитываем состояние под этой сессией: два параллельных запроса
        # не должны обе делать collecting→training (второй → InvalidTransition).
        if JobState(db_job.state) is not JobState.COLLECTING:
            return JSONResponse({"error": "order_not_found"}, status_code=409)
        if not (db_job.clothing_csv and db_job.background_csv):
            db_job.styles_csv = ",".join(chosen)
        db_job.state = validate_transition(JobState(db_job.state), JobState.TRAINING)
        await session.commit()

    _notify_admins_bg(
        request.app.state.settings,
        f"🚀 Заказ #{job.id} («{pkg.title}») — фото загружены, образы выбраны, "
        f"генерация запущена. Контакт: {job.contact}",
    )
    return {"state": "training", "price_rub": pkg.price_rub}


@app.post("/api/payments/yookassa")
async def yookassa_webhook(request: Request):
    """Вебхук ЮKassa. Payload не считаем доверенным: перечитываем платёж по API."""
    payments: YooKassaClient | None = request.app.state.payments
    if payments is None:
        return JSONResponse({"error": "payments_disabled"}, status_code=503)
    try:
        body = await request.json()
        payment_id = body["object"]["id"]
    except Exception:
        return JSONResponse({"error": "bad_payload"}, status_code=400)

    try:
        payment = await payments.get_payment(payment_id)
    except Exception:
        return JSONResponse({"error": "verify_failed"}, status_code=502)

    if payment.status != "succeeded":
        return {"ok": True}  # ждём финального статуса

    async with request.app.state.session_factory() as session:
        stmt = select(Job).where(Job.payment_id == payment.id)
        job = (await session.execute(stmt)).scalar_one_or_none()
        if job is None:
            return JSONResponse({"error": "order_not_found"}, status_code=404)
        job_id, pkg_code, contact = job.id, job.package_code, job.contact
        awaiting = JobState(job.state) is JobState.AWAITING_PAYMENT
    if awaiting:
        # Селфи-первый флоу: фото уже загружены → генерация стартует сразу.
        target = await _confirm_paid(request, job_id)
        pkg = get_package(pkg_code)
        tail = ("Генерация запущена." if target == JobState.TRAINING.value
                else "Клиент загружает фото.")
        _notify_admins_bg(
            request.app.state.settings,
            f"✅ ОПЛАЧЕН заказ #{job_id}: «{pkg.title}» {pkg.price_rub} ₽, "
            f"контакт: {contact}. {tail}",
        )
    return {"ok": True}


@app.get("/api/orders/{token}")
async def order_status(request: Request, token: str):
    job = await _job_by_token(request, token)
    if job is None:
        return JSONResponse({"error": "order_not_found"}, status_code=404)
    async with request.app.state.session_factory() as session:
        src_stmt = select(func.count()).select_from(Photo).where(
            Photo.job_id == job.id, Photo.kind == Photo.SOURCE
        )
        photos = (await session.execute(src_stmt)).scalar() or 0
        results_stmt = select(Photo).where(
            Photo.job_id == job.id, Photo.kind == Photo.RESULT
        )
        results = (await session.execute(results_stmt)).scalars().all()
        pending_remixes = (await session.execute(
            select(func.count()).select_from(RemixTask).where(
                RemixTask.job_id == job.id, RemixTask.state == RemixTask.PENDING))
        ).scalar() or 0
    return {
        "state": job.state,
        "photos": photos,
        "min": MIN_PHOTOS,
        "max": MAX_PHOTOS,
        "package": job.package_code,
        "gender": job.gender,
        "remixes_left": job.remixes_left or 0,
        "pending_remixes": pending_remixes,
        "results": [
            {"id": p.id, "style": p.style, "url": f"/api/orders/{token}/result/{p.id}"}
            for p in results
        ]
        if JobState(job.state) is JobState.DONE
        else [],
    }


_LOOK_RE = re.compile(r"^(?:look|remix)\d+_(.+)__(.+)$")


def _split_look(style: str) -> tuple[str, str] | None:
    """Из ключа кадра (look{i}_{cl}__{bg} / remix{i}_{cl}__{bg}) вернуть (cl, bg)."""
    m = _LOOK_RE.match(style or "")
    return (m.group(1), m.group(2)) if m else None


@app.post("/api/orders/{token}/remix")
async def order_remix(
    request: Request,
    token: str,
    source: str = Form(...),          # style-ключ кадра-источника
    mode: str = Form(...),            # clothing | background | regen
    clothing: str = Form(""),        # новый ключ одежды (mode=clothing)
    background: str = Form(""),      # новый ключ фона (mode=background)
):
    """Remix готового заказа: 1 credit → 1 новый кадр на обученной модели.
    Сменить одежду / сменить фон / перегенерировать."""
    if mode not in ("clothing", "background", "regen"):
        return JSONResponse({"error": "bad_mode"}, status_code=422)
    job = await _job_by_token(request, token)
    if job is None or JobState(job.state) is not JobState.DONE or not job.model_ref:
        return JSONResponse({"error": "order_not_found"}, status_code=404)
    pair = _split_look(source)
    if pair is None:
        return JSONResponse({"error": "bad_source"}, status_code=422)
    cur_cl, cur_bg = pair
    new_cl = clothing if mode == "clothing" else cur_cl
    new_bg = background if mode == "background" else cur_bg
    wl: WardrobeLibrary = request.app.state.wardrobe
    try:
        wl.resolve("clothing", [new_cl], job.gender)
        wl.resolve("background", [new_bg])
    except ValueError:
        return JSONResponse({"error": "bad_wardrobe"}, status_code=422)

    # Резервируем credit атомарно: списываем только если остаток > 0.
    async with request.app.state.session_factory() as session:
        db_job = await session.get(Job, job.id)
        # Источник должен принадлежать этому заказу.
        owns = (await session.execute(select(func.count()).select_from(Photo).where(
            Photo.job_id == job.id, Photo.kind == Photo.RESULT, Photo.style == source))
        ).scalar() or 0
        if not owns:
            return JSONResponse({"error": "bad_source"}, status_code=422)
        if (db_job.remixes_left or 0) <= 0:
            return JSONResponse({"error": "no_remixes"}, status_code=409)
        db_job.remixes_left -= 1
        session.add(RemixTask(job_id=job.id, mode=mode,
                              clothing_key=new_cl, background_key=new_bg))
        await session.commit()
        left = db_job.remixes_left
    return {"ok": True, "remixes_left": left}


@app.get("/api/orders/{token}/result/{photo_id}")
async def order_result(request: Request, token: str, photo_id: int, full: int = 0):
    """Кадр результата. По умолчанию превью; ?full=1 — полный размер,
    первый такой доступ фиксируется как «получение результата» (условия
    добровольной гарантии возврата в оферте)."""
    job = await _job_by_token(request, token)
    if job is None:
        return JSONResponse({"error": "order_not_found"}, status_code=404)
    async with request.app.state.session_factory() as session:
        photo = await session.get(Photo, photo_id)
        if photo is None or photo.job_id != job.id or photo.kind != Photo.RESULT:
            return JSONResponse({"error": "not_found"}, status_code=404)
        if full:
            db_job = await session.get(Job, job.id)
            if db_job.downloaded_at is None:
                db_job.downloaded_at = utcnow()
                await session.commit()
    data = request.app.state.storage.get(photo.storage_key)
    if not full:
        from io import BytesIO

        from PIL import Image

        img = Image.open(BytesIO(data))
        img.thumbnail((640, 640))
        buf = BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=82)
        data = buf.getvalue()
    return Response(content=data, media_type="image/jpeg")


APP_DIR = STATIC_DIR / "app"


@app.get("/order")
async def order_redirect(request: Request):
    # Старый статический мастер заменён React-приложением.
    q = request.url.query
    return RedirectResponse("/app/order" + (f"?{q}" if q else ""), status_code=307)


@app.get("/app")
@app.get("/app/{full_path:path}")
async def spa(full_path: str = "") -> FileResponse:
    # Отдаём собранные ассеты, всё остальное — index.html (client-side роутинг).
    if full_path:
        candidate = (APP_DIR / full_path).resolve()
        if candidate.is_file() and candidate.is_relative_to(APP_DIR.resolve()):
            return FileResponse(candidate)
    return FileResponse(APP_DIR / "index.html")


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/free")
async def free_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "free.html")


@app.get("/legal")
async def legal_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "legal.html")


@app.get("/privacy")
async def privacy_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "privacy.html")


@app.get("/offer")
async def offer_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "offer.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

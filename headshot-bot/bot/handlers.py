"""Хендлеры бота: онбординг → согласие → фото → тизер → пакет → оплата → доставка."""
import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timezone

from aiogram import Bot, F, Router
from aiogram.filters import Command, CommandStart
from pathlib import Path

from aiogram.types import (
    BufferedInputFile,
    FSInputFile,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InputMediaPhoto,
    Message,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bot import texts
from config import Settings
from core.email import send_email, send_payment_email
from core.models import Job, Photo, User
from core.packages import PACKAGES, get_package
from core.states import JobState, validate_transition
from core.validation import validate_photo
from prompts.library import StyleLibrary
from storage.files import FileStorage

log = logging.getLogger(__name__)
router = Router()

# Фото из альбома приходят параллельными апдейтами — обработку фото одного
# пользователя сериализуем, иначе гонка по счётчику (дубли "Фото 3 из 15").
_photo_locks: dict[int, asyncio.Lock] = defaultdict(asyncio.Lock)

# Предложение пакетов отправляем после паузы в загрузке, чтобы не
# вклиниваться в альбом: каждое новое фото передвигает таймер.
# Превью в платном флоу нет намеренно (якорение качества) — бесплатная
# генерация живёт на отдельной странице сайта для холодного трафика.
_offer_tasks: dict[int, asyncio.Task] = {}
# Заказы, которым предложение пакетов уже отправлено — чтобы не слать повторно
# при каждой новой паузе в загрузке.
_offered: set[int] = set()
OFFER_DEBOUNCE_SECONDS = 3.0


async def _say(query: CallbackQuery, text: str, reply_markup=None) -> None:
    """Ответ на callback: обычно в исходное сообщение, но оно может быть
    недоступно (старше 48 часов) — тогда шлём напрямую пользователю."""
    if query.message is not None:
        await query.message.answer(text, reply_markup=reply_markup)
    else:
        await query.bot.send_message(query.from_user.id, text, reply_markup=reply_markup)

# Зависимости кладутся в workflow_data диспетчера (см. main.py):
# settings, session_factory, provider, file_storage, styles.
# Имя "storage" занято aiogram под FSM-хранилище — используем file_storage.


def _consent_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text=texts.CONSENT_BUTTON, callback_data="consent")]]
    )


def _packages_kb() -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=texts.PAY_BUTTON.format(
                    title=p.title, portraits=p.portraits, price=p.price_rub
                ),
                callback_data=f"buy:{p.code}",
            )
        ]
        for p in PACKAGES.values()
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _get_or_create_user(session: AsyncSession, tg_id: int) -> User:
    user = (
        await session.execute(select(User).where(User.tg_id == tg_id))
    ).scalar_one_or_none()
    if user is None:
        user = User(tg_id=tg_id)
        session.add(user)
        await session.commit()
    return user


async def _active_job(session: AsyncSession, user_id: int, *states: JobState) -> Job | None:
    stmt = (
        select(Job)
        .where(Job.user_id == user_id, Job.state.in_([s.value for s in states]))
        .order_by(Job.created_at.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


EXAMPLES_COLLAGE = Path(__file__).resolve().parents[1] / "web/static/img/gen/bot_examples.jpg"


@router.message(CommandStart())
async def cmd_start(message: Message, session_factory: async_sessionmaker) -> None:
    async with session_factory() as session:
        user = await _get_or_create_user(session, message.from_user.id)
        if user.consent_at is not None:
            # Согласие уже есть: сразу открываем (или продолжаем) сбор фото.
            job = await _active_job(session, user.id, JobState.COLLECTING)
            if job is None:
                session.add(Job(user_id=user.id, state=JobState.COLLECTING))
                await session.commit()
            await message.answer(texts.CONSENT_SAVED)
            return
    # Приветствие с коллажем примеров: продаёт картинка, не текст.
    if EXAMPLES_COLLAGE.exists():
        await message.answer_photo(
            FSInputFile(EXAMPLES_COLLAGE), caption=texts.START, reply_markup=_consent_kb()
        )
    else:
        await message.answer(texts.START, reply_markup=_consent_kb())
    await message.answer(texts.CONSENT_INFO)


@router.message(Command("privacy"))
async def cmd_privacy(message: Message) -> None:
    await message.answer(texts.PRIVACY)


@router.callback_query(F.data == "consent")
async def on_consent(query: CallbackQuery, session_factory: async_sessionmaker) -> None:
    async with session_factory() as session:
        user = await _get_or_create_user(session, query.from_user.id)
        if user.consent_at is None:
            user.consent_at = datetime.now(timezone.utc)
        job = await _active_job(session, user.id, JobState.COLLECTING)
        if job is None:
            session.add(Job(user_id=user.id, state=JobState.COLLECTING))
        await session.commit()
    await _say(query, texts.CONSENT_SAVED)
    await query.answer()


@router.message(F.photo)
async def on_photo(
    message: Message,
    bot: Bot,
    settings: Settings,
    session_factory: async_sessionmaker,
    file_storage: FileStorage,
) -> None:
    # Скачивание — вне блокировки (долгий I/O), учёт — строго под ней.
    file = await bot.get_file(message.photo[-1].file_id)
    buf = await bot.download_file(file.file_path)
    data = buf.read()

    async with _photo_locks[message.from_user.id]:
        async with session_factory() as session:
            user = await _get_or_create_user(session, message.from_user.id)
            if user.consent_at is None:
                await message.answer(texts.NEED_CONSENT, reply_markup=_consent_kb())
                return
            job = await _active_job(session, user.id, JobState.COLLECTING)
            if job is None:
                await message.answer(texts.NO_ACTIVE_JOB)
                return

            check = validate_photo(data)
            if not check.ok:
                await message.answer(texts.PHOTO_REJECTED[check.reason])
                return

            count_stmt = select(Photo).where(
                Photo.job_id == job.id, Photo.kind == Photo.SOURCE
            )
            existing = len((await session.execute(count_stmt)).scalars().all())
            if existing >= settings.max_source_photos:
                await message.answer(texts.PHOTO_LIMIT.format(max=settings.max_source_photos))
                return

            key = file_storage.put(f"jobs/{job.id}/{Photo.SOURCE}/{existing:02d}.jpg", data)
            session.add(Photo(job_id=job.id, kind=Photo.SOURCE, storage_key=key))
            await session.commit()
            n = existing + 1
            job_id = job.id

        if n < settings.min_source_photos:
            await message.answer(
                texts.PHOTO_ACCEPTED.format(n=n, max=settings.max_source_photos)
            )
        elif n == settings.min_source_photos:
            await message.answer(
                texts.PHOTO_ENOUGH.format(n=n, max=settings.max_source_photos)
            )
        else:
            await message.answer(
                texts.PHOTO_ACCEPTED_EXTRA.format(n=n, max=settings.max_source_photos)
            )

    # Фото достаточно — планируем предложение пакетов (один раз на заказ);
    # каждое следующее фото сдвигает таймер, так что оно придёт после альбома.
    if n >= settings.min_source_photos and job_id not in _offered:
        pending = _offer_tasks.pop(job_id, None)
        if pending is not None:
            pending.cancel()
        _offer_tasks[job_id] = asyncio.create_task(
            _offer_packages_after_quiet(message, job_id, session_factory)
        )


async def _offer_packages_after_quiet(
    message: Message, job_id: int, session_factory: async_sessionmaker
) -> None:
    """Ждёт паузу в загрузке и предлагает пакеты — один раз на заказ."""
    await asyncio.sleep(OFFER_DEBOUNCE_SECONDS)
    _offer_tasks.pop(job_id, None)

    async with session_factory() as session:
        job = await session.get(Job, job_id)
        # Предлагаем только пока идёт сбор и пакет ещё не выбран (заказ мог
        # быть отменён через /delete_my_data за время паузы).
        if job is None or job.package_code is not None \
                or JobState(job.state) is not JobState.COLLECTING:
            return

    _offered.add(job_id)
    await message.answer(texts.PACKAGES_OFFER, reply_markup=_packages_kb())


def _styles_kb(styles: StyleLibrary, chosen: set[str], required: int) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(
                text=("☑ " if s.key in chosen else "☐ ") + s.title,
                callback_data=f"style:{s.key}",
            )
        ]
        for s in styles.styles
    ]
    rows.append(
        [
            InlineKeyboardButton(
                text=texts.STYLES_DONE_BUTTON.format(n=len(chosen), k=required),
                callback_data="styles_done",
            )
        ]
    )
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _request_payment(
    query: CallbackQuery, settings: Settings, job_id: int, package
) -> None:
    if settings.manual_payment:
        await _say(
            query,
            texts.MANUAL_PAYMENT_INFO.format(title=package.title, price=package.price_rub),
        )
        for admin_id in settings.admin_tg_ids:
            await query.bot.send_message(
                admin_id,
                f"Новый заказ #{job_id}: пакет «{package.title}», "
                f"пользователь {query.from_user.id}. Подтвердить: /approve_{job_id}",
            )
    else:
        # Онлайн-оплата в боте пока не подключена: не оставляем клиента молча
        # в awaiting_payment — говорим, что свяжемся, и уведомляем админов.
        await _say(query, texts.MANUAL_PAYMENT_INFO.format(
            title=package.title, price=package.price_rub))
        for admin_id in settings.admin_tg_ids:
            await query.bot.send_message(
                admin_id,
                f"Заказ #{job_id} ждёт оплаты (пакет «{package.title}», "
                f"пользователь {query.from_user.id}). Подтвердить: /approve_{job_id}",
            )


@router.callback_query(F.data.startswith("buy:"))
async def on_buy(
    query: CallbackQuery,
    settings: Settings,
    session_factory: async_sessionmaker,
    styles: StyleLibrary,
) -> None:
    package = get_package(query.data.split(":", 1)[1])
    total = len(styles.styles)
    async with session_factory() as session:
        user = await _get_or_create_user(session, query.from_user.id)
        job = await _active_job(session, user.id, JobState.COLLECTING)
        if job is None:
            await query.answer(texts.NO_ACTIVE_JOB, show_alert=True)
            return
        job.package_code = package.code
        if package.styles < total:
            # Пакет с выбором образов: остаёмся в сборе, ждём отметки стилей.
            job.styles_csv = ""
            await session.commit()
            await _say(
                query,
                texts.CHOOSE_STYLES.format(
                    title=package.title,
                    k=package.styles,
                    total=total,
                    per_style=package.portraits_per_style(),
                    pro_price=PACKAGES["pro"].price_rub,
                ),
                reply_markup=_styles_kb(styles, set(), package.styles),
            )
            await query.answer()
            return
        # Пакет со всеми образами — сразу к оплате.
        job.styles_csv = ",".join(s.key for s in styles.styles)
        job.state = validate_transition(JobState(job.state), JobState.AWAITING_PAYMENT)
        await session.commit()
        job_id = job.id

    await _request_payment(query, settings, job_id, package)
    await query.answer()


@router.callback_query(F.data.startswith("style:"))
async def on_style_toggle(
    query: CallbackQuery, session_factory: async_sessionmaker, styles: StyleLibrary
) -> None:
    key = query.data.split(":", 1)[1]
    async with session_factory() as session:
        user = await _get_or_create_user(session, query.from_user.id)
        job = await _active_job(session, user.id, JobState.COLLECTING)
        if job is None or not job.package_code:
            await query.answer(texts.NO_ACTIVE_JOB, show_alert=True)
            return
        package = get_package(job.package_code)
        chosen = set(filter(None, (job.styles_csv or "").split(",")))
        if key in chosen:
            chosen.discard(key)
        elif len(chosen) >= package.styles:
            await query.answer(texts.STYLES_LIMIT.format(k=package.styles), show_alert=True)
            return
        else:
            chosen.add(key)
        job.styles_csv = ",".join(sorted(chosen))
        await session.commit()

    if query.message is not None:
        await query.message.edit_reply_markup(
            reply_markup=_styles_kb(styles, chosen, package.styles)
        )
    await query.answer()


@router.callback_query(F.data == "styles_done")
async def on_styles_done(
    query: CallbackQuery, settings: Settings, session_factory: async_sessionmaker
) -> None:
    async with session_factory() as session:
        user = await _get_or_create_user(session, query.from_user.id)
        job = await _active_job(session, user.id, JobState.COLLECTING)
        if job is None or not job.package_code:
            await query.answer(texts.NO_ACTIVE_JOB, show_alert=True)
            return
        package = get_package(job.package_code)
        chosen = set(filter(None, (job.styles_csv or "").split(",")))
        if len(chosen) < package.styles:
            await query.answer(
                texts.STYLES_INCOMPLETE.format(left=package.styles - len(chosen)),
                show_alert=True,
            )
            return
        job.state = validate_transition(JobState(job.state), JobState.AWAITING_PAYMENT)
        await session.commit()
        job_id = job.id

    await _request_payment(query, settings, job_id, package)
    await query.answer()


@router.message(F.text.regexp(r"^/approve_(\d+)$"))
async def on_approve(
    message: Message, settings: Settings, bot: Bot, session_factory: async_sessionmaker
) -> None:
    if message.from_user.id not in settings.admin_tg_ids:
        return
    job_id = int(message.text.rsplit("_", 1)[1])
    async with session_factory() as session:
        job = await session.get(Job, job_id)
        if job is None or JobState(job.state) is not JobState.AWAITING_PAYMENT:
            await message.answer(f"Заказ {job_id} не найден или не ждёт оплаты.")
            return
        # Бот собирает фото ДО оплаты → сразу в тренировку. Веб (селфи-первый
        # флоу) обычно уже с загруженными селфи → тоже в тренировку; если фото
        # ещё нет (легаси «оплата вперёд») — в collecting.
        is_web = job.channel == "web"
        if is_web:
            cnt = (await session.execute(select(func.count()).select_from(Photo).where(
                Photo.job_id == job.id, Photo.kind == Photo.SOURCE))).scalar() or 0
            target = JobState.TRAINING if cnt >= 10 else JobState.COLLECTING
        else:
            target = JobState.TRAINING
        job.state = validate_transition(JobState(job.state), target)
        tg_id = (await job.awaitable_attrs.user).tg_id
        web_contact, web_token = job.contact, job.access_token
        await session.commit()
    started = target is JobState.TRAINING
    if is_web:  # веб-клиенту — письмо «оплата получена» со ссылкой на заказ
        await send_payment_email(settings, web_contact or "", web_token, started=started)
    elif tg_id > 0:
        await bot.send_message(tg_id, texts.PAYMENT_CONFIRMED)
    await message.answer(
        f"Заказ {job_id} — оплата подтверждена. "
        + ("Запущен в работу." if started else "Клиент загружает фото на сайте.")
    )


@router.message(Command("delete_my_data"))
async def cmd_delete_my_data(
    message: Message, session_factory: async_sessionmaker, file_storage: FileStorage
) -> None:
    async with session_factory() as session:
        user = (
            await session.execute(select(User).where(User.tg_id == message.from_user.id))
        ).scalar_one_or_none()
        jobs = (
            (await session.execute(select(Job).where(Job.user_id == user.id))).scalars().all()
            if user is not None
            else []
        )
        if not jobs:
            await message.answer(texts.NO_DATA_TO_DELETE)
            return
        for job in jobs:
            # Отменяем отложенное предложение пакетов, чтобы оно не пришло
            # уже после удаления данных.
            pending = _offer_tasks.pop(job.id, None)
            if pending is not None:
                pending.cancel()
            _offered.discard(job.id)
            file_storage.delete_job(job.id)
            for photo in await session.execute(select(Photo).where(Photo.job_id == job.id)):
                await session.delete(photo[0])
            job.model_ref = None
            if JobState(job.state) not in (JobState.DONE, JobState.CANCELLED, JobState.FAILED):
                job.state = JobState.CANCELLED
        await session.commit()
    await message.answer(texts.DATA_DELETED)


async def deliver_results(
    bot: Bot,
    storage: FileStorage,
    settings: Settings,
    session_factory: async_sessionmaker,
    job_id: int,
    tg_id: int,
    result_keys: list[str],
) -> None:
    """Колбэк доставки для воркера.

    Telegram-заказы: шлём готовые кадры альбомами по 10 фото.
    Веб-заказы (синтетический tg_id <= 0): фото не шлём в Telegram — клиент
    смотрит галерею на сайте; вместо этого отправляем письмо «портреты готовы»
    со ссылкой на его заказ (иначе после сбоя/закрытия вкладки он не узнает).
    """
    if tg_id <= 0:  # синтетические веб-пользователи имеют tg_id <= 0
        await _email_web_ready(settings, session_factory, job_id, len(result_keys))
        return
    for start in range(0, len(result_keys), 10):
        chunk = result_keys[start : start + 10]
        files = [
            BufferedInputFile(storage.get(key), filename=key.rsplit("/", 1)[-1])
            for key in chunk
        ]
        # send_media_group требует 2–10 элементов; одиночный кадр шлём как фото.
        if len(files) == 1:
            await bot.send_photo(tg_id, files[0])
        else:
            await bot.send_media_group(tg_id, [InputMediaPhoto(media=f) for f in files])
    await bot.send_message(tg_id, texts.DELIVERY_DONE)


async def _email_web_ready(
    settings: Settings, session_factory: async_sessionmaker, job_id: int, n_photos: int
) -> None:
    """Письмо клиенту о готовности web-заказа со ссылкой на его галерею.

    Отправляем только на настоящий email (в contact может быть синтетический
    адрес автотестов вида *@d-portret.ru). Ошибку письма глушим — доставка
    заказа не должна падать из-за недоступной почты (есть outbox-фолбэк)."""
    async with session_factory() as session:
        job = await session.get(Job, job_id)
        if job is None:
            return
        to = (job.contact or "").strip()
        token = job.access_token
    if "@" not in to or to.lower().endswith("@d-portret.ru"):
        return  # телефон/синтетика — письмо не шлём
    base = settings.public_base_url
    link = f"{base}/app/order?t={token}" if token else f"{base}/app/login"
    subject = "Ваши деловые портреты готовы ✨"
    text = (
        "Здравствуйте!\n\n"
        f"Ваши портреты готовы — всего {n_photos} кадров. "
        "Откройте галерею и скачайте снимки в полном размере:\n"
        f"{link}\n\n"
        "Ссылка личная — не пересылайте её. Вы также можете войти в личный "
        f"кабинет на {base} под своим email.\n\n"
        "Спасибо, что выбрали «Деловой Портрет»!"
    )
    html = (
        '<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1B1D22">'
        '<h2 style="font-weight:600">Ваши портреты готовы ✨</h2>'
        f'<p style="font:15px/1.6 system-ui,sans-serif">Готово <b>{n_photos}</b> кадров. '
        'Откройте галерею и скачайте снимки в полном размере:</p>'
        f'<p><a href="{link}" style="display:inline-block;background:#1B1D22;color:#fff;'
        'text-decoration:none;padding:13px 26px;border-radius:999px;'
        'font:650 15px system-ui,sans-serif">Открыть мои портреты</a></p>'
        '<p style="font:13px/1.6 system-ui,sans-serif;color:#6A6D74">Ссылка личная — '
        f'не пересылайте её. Также можно войти в кабинет на {base} под своим email.<br>'
        'Спасибо, что выбрали «Деловой Портрет»!</p></div>'
    )
    try:
        await send_email(settings, to, subject, text, html)
    except Exception:
        log.exception("Не удалось отправить письмо о готовности заказа %s", job_id)

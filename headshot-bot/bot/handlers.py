"""Хендлеры бота: онбординг → согласие → фото → тизер → пакет → оплата → доставка."""
import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timezone

from aiogram import Bot, F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    BufferedInputFile,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InputMediaPhoto,
    Message,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from bot import texts
from config import Settings
from core.models import Job, Photo, User
from core.packages import PACKAGES, get_package
from core.states import JobState, validate_transition
from core.validation import validate_photo
from prompts.library import StyleLibrary
from providers.base import ImageGenProvider
from storage.files import FileStorage

log = logging.getLogger(__name__)
router = Router()

# Фото из альбома приходят параллельными апдейтами — обработку фото одного
# пользователя сериализуем, иначе гонка по счётчику (дубли "Фото 3 из 15").
_photo_locks: dict[int, asyncio.Lock] = defaultdict(asyncio.Lock)

# Превью отправляем после паузы в загрузке, чтобы не вклиниваться в альбом:
# каждое новое фото передвигает таймер.
_teaser_tasks: dict[int, asyncio.Task] = {}
TEASER_DEBOUNCE_SECONDS = 3.0

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
    await query.message.answer(texts.CONSENT_SAVED)
    await query.answer()


@router.message(F.photo)
async def on_photo(
    message: Message,
    bot: Bot,
    settings: Settings,
    session_factory: async_sessionmaker,
    provider: ImageGenProvider,
    file_storage: FileStorage,
    styles: StyleLibrary,
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

    # Фото достаточно — планируем превью; каждое следующее фото сдвигает таймер,
    # так что оно придёт после окончания альбома, а не в середине.
    if n >= settings.min_source_photos:
        pending = _teaser_tasks.pop(job_id, None)
        if pending is not None:
            pending.cancel()
        _teaser_tasks[job_id] = asyncio.create_task(
            _teaser_after_quiet(
                message, job_id, data, session_factory, provider, file_storage, styles
            )
        )


async def _teaser_after_quiet(
    message: Message,
    job_id: int,
    photo: bytes,
    session_factory: async_sessionmaker,
    provider: ImageGenProvider,
    file_storage: FileStorage,
    styles: StyleLibrary,
) -> None:
    """Ждёт паузу в загрузке и шлёт превью один раз на заказ."""
    await asyncio.sleep(TEASER_DEBOUNCE_SECONDS)
    _teaser_tasks.pop(job_id, None)

    async with session_factory() as session:
        marker_stmt = select(Photo).where(
            Photo.job_id == job_id, Photo.kind == Photo.TEASER
        )
        if (await session.execute(marker_stmt)).scalars().first() is not None:
            return  # превью по этому заказу уже отправлено

    try:
        teaser = await provider.teaser(photo, styles.teaser_prompt)
    except Exception:
        log.exception("Тизер не сгенерировался (job %s)", job_id)
        await message.answer(texts.TEASER_FAILED, reply_markup=_packages_kb())
        return

    key = file_storage.put(f"jobs/{job_id}/{Photo.TEASER}/preview.jpg", teaser)
    async with session_factory() as session:
        session.add(Photo(job_id=job_id, kind=Photo.TEASER, storage_key=key))
        await session.commit()

    await message.answer_photo(
        BufferedInputFile(teaser, filename="preview.jpg"),
        caption=texts.TEASER_CAPTION,
        reply_markup=_packages_kb(),
    )


@router.callback_query(F.data.startswith("buy:"))
async def on_buy(
    query: CallbackQuery, settings: Settings, session_factory: async_sessionmaker
) -> None:
    package = get_package(query.data.split(":", 1)[1])
    async with session_factory() as session:
        user = await _get_or_create_user(session, query.from_user.id)
        job = await _active_job(session, user.id, JobState.COLLECTING)
        if job is None:
            await query.answer(texts.NO_ACTIVE_JOB, show_alert=True)
            return
        job.package_code = package.code
        job.state = validate_transition(JobState(job.state), JobState.AWAITING_PAYMENT)
        await session.commit()
        job_id = job.id

    if settings.manual_payment:
        await query.message.answer(
            texts.MANUAL_PAYMENT_INFO.format(title=package.title, price=package.price_rub)
        )
        for admin_id in settings.admin_tg_ids:
            await query.bot.send_message(
                admin_id,
                f"Новый заказ #{job_id}: пакет {package.code}, "
                f"пользователь {query.from_user.id}. Подтвердить: /approve_{job_id}",
            )
    # Ветка Telegram Payments/ЮKassa добавляется на этапе 3.
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
        job.state = validate_transition(JobState(job.state), JobState.TRAINING)
        tg_id = (await job.awaitable_attrs.user).tg_id
        await session.commit()
    await bot.send_message(tg_id, texts.PAYMENT_CONFIRMED)
    await message.answer(f"Заказ {job_id} запущен в работу.")


@router.message(Command("delete_my_data"))
async def cmd_delete_my_data(
    message: Message, session_factory: async_sessionmaker, file_storage: FileStorage
) -> None:
    async with session_factory() as session:
        user = (
            await session.execute(select(User).where(User.tg_id == message.from_user.id))
        ).scalar_one_or_none()
        if user is None:
            await message.answer(texts.DATA_DELETED)
            return
        jobs = (await session.execute(select(Job).where(Job.user_id == user.id))).scalars().all()
        for job in jobs:
            file_storage.delete_job(job.id)
            for photo in await session.execute(select(Photo).where(Photo.job_id == job.id)):
                await session.delete(photo[0])
            job.model_ref = None
            if JobState(job.state) not in (JobState.DONE, JobState.CANCELLED, JobState.FAILED):
                job.state = JobState.CANCELLED
        await session.commit()
    await message.answer(texts.DATA_DELETED)


async def deliver_results(
    bot: Bot, storage: FileStorage, job_id: int, tg_id: int, result_keys: list[str]
) -> None:
    """Колбэк доставки для воркера: шлём альбомами по 10 фото."""
    for start in range(0, len(result_keys), 10):
        chunk = result_keys[start : start + 10]
        media = [
            InputMediaPhoto(
                media=BufferedInputFile(storage.get(key), filename=key.rsplit("/", 1)[-1])
            )
            for key in chunk
        ]
        await bot.send_media_group(tg_id, media)
    await bot.send_message(tg_id, texts.DELIVERY_DONE)

"""Точка входа: собирает зависимости, запускает бота и воркер."""
import asyncio
import functools
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import BotCommand

from bot.handlers import deliver_results, router
from config import load_settings
from core.db import init_db, make_engine, make_session_factory
from prompts.library import StyleLibrary
from storage.files import FileStorage
from worker import Worker


from providers.factory import make_provider


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    settings = load_settings()
    if not settings.bot_token:
        raise SystemExit("Задайте BOT_TOKEN")

    settings.data_dir.mkdir(parents=True, exist_ok=True)
    engine = make_engine(settings.db_url)
    await init_db(engine)
    session_factory = make_session_factory(engine)
    storage = FileStorage(settings.data_dir / "files")
    styles = StyleLibrary.load()
    provider = make_provider(settings)

    bot = Bot(settings.bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    # Кнопка «Меню» в клиенте Telegram — команды доступны в любой момент.
    await bot.set_my_commands(
        [
            BotCommand(command="start", description="Начать новую фотосессию"),
            BotCommand(command="privacy", description="Как хранятся мои данные"),
            BotCommand(command="delete_my_data", description="Удалить все мои данные"),
        ]
    )
    # "storage" зарезервировано aiogram под FSM — файловое хранилище как file_storage.
    dp = Dispatcher(
        settings=settings,
        session_factory=session_factory,
        provider=provider,
        file_storage=storage,
        styles=styles,
    )
    dp.include_router(router)

    enhancer = qc = None
    if settings.provider == "fal":
        if settings.quality_enhance:
            from providers.quality import FalCodeformerEnhancer

            enhancer = FalCodeformerEnhancer()
        if settings.quality_qc:
            from providers.quality import FalVisionQC

            qc = FalVisionQC()

    worker = Worker(
        session_factory=session_factory,
        provider=provider,
        storage=storage,
        styles=styles,
        deliver=functools.partial(deliver_results, bot, storage, settings, session_factory),
        enhancer=enhancer,
        qc=qc,
    )

    # Ретеншн (авто-удаление исходных фото по сроку) держит веб-процесс
    # (core.retention.purge_expired) — единый владелец, чтобы не гонять
    # две очистки на общей БД и не удалить оплаченные результаты.
    background = [
        asyncio.create_task(worker.run_forever()),
    ]
    try:
        # start_polling сам обрабатывает SIGTERM/SIGINT; по его завершении
        # гасим фоновые задачи, иначе процесс зависает после остановки polling.
        await dp.start_polling(bot)
    finally:
        for task in background:
            task.cancel()
        await asyncio.gather(*background, return_exceptions=True)


if __name__ == "__main__":
    asyncio.run(main())

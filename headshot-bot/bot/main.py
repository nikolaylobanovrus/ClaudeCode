"""Точка входа: собирает зависимости, запускает бота и воркер."""
import asyncio
import functools
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from bot.handlers import deliver_results, router
from config import load_settings
from core.db import init_db, make_engine, make_session_factory
from prompts.library import StyleLibrary
from storage.files import FileStorage
from worker import Worker


def make_provider(settings):
    if settings.provider == "fal":
        from providers.fal_flux import FalFluxProvider

        return FalFluxProvider(settings.fal_key)
    from providers.fake import FakeProvider

    return FakeProvider()


async def retention_loop(storage: FileStorage, retention_days: int) -> None:
    """Автоудаление данных старше retention_days (проверка раз в час)."""
    while True:
        purged = storage.purge_older_than(retention_days * 86400)
        if purged:
            logging.info("Автоудаление: очищены заказы %s", purged)
        await asyncio.sleep(3600)


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
    # "storage" зарезервировано aiogram под FSM — файловое хранилище как file_storage.
    dp = Dispatcher(
        settings=settings,
        session_factory=session_factory,
        provider=provider,
        file_storage=storage,
        styles=styles,
    )
    dp.include_router(router)

    worker = Worker(
        session_factory=session_factory,
        provider=provider,
        storage=storage,
        styles=styles,
        deliver=functools.partial(deliver_results, bot, storage),
    )

    background = [
        asyncio.create_task(worker.run_forever()),
        asyncio.create_task(retention_loop(storage, settings.retention_days)),
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

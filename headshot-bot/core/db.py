"""Инициализация БД и фабрика сессий."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.models import Base


def make_engine(db_url: str):
    return create_async_engine(db_url, echo=False)


def make_session_factory(engine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


async def init_db(engine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Мини-миграция для SQLite: create_all не добавляет колонки в
        # существующие таблицы. До Postgres/Alembic этого достаточно.
        if engine.dialect.name == "sqlite":
            cols = [r[1] for r in await conn.execute(text("PRAGMA table_info(jobs)"))]
            for name, ddl in (
                ("styles_csv", "ALTER TABLE jobs ADD COLUMN styles_csv TEXT"),
                ("channel", "ALTER TABLE jobs ADD COLUMN channel VARCHAR(8) DEFAULT 'tg'"),
                ("contact", "ALTER TABLE jobs ADD COLUMN contact TEXT"),
                ("access_token", "ALTER TABLE jobs ADD COLUMN access_token VARCHAR(64)"),
                ("payment_id", "ALTER TABLE jobs ADD COLUMN payment_id VARCHAR(64)"),
            ):
                if name not in cols:
                    await conn.execute(text(ddl))

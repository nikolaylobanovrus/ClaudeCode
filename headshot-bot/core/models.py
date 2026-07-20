"""Модели БД (SQLAlchemy 2.0, async)."""
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from core.states import JobState


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(AsyncAttrs, DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tg_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    # Момент согласия на обработку фото (биометрические ПД). None = согласия нет.
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    jobs: Mapped[list["Job"]] = relationship(back_populates="user")


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    state: Mapped[str] = mapped_column(String(32), default=JobState.COLLECTING, index=True)
    package_code: Mapped[str | None] = mapped_column(String(32), default=None)
    # Ссылка на обученную identity-модель у провайдера (URL LoRA-весов и т.п.).
    model_ref: Mapped[str | None] = mapped_column(Text, default=None)
    # Выбранные пользователем образы (ключи стилей через запятую).
    styles_csv: Mapped[str | None] = mapped_column(Text, default=None)
    # Канал заказа: "tg" (бот) или "web" (сайт).
    channel: Mapped[str] = mapped_column(String(8), default="tg")
    # Контакт для веб-заказов (email/телефон, как указал клиент).
    contact: Mapped[str | None] = mapped_column(Text, default=None)
    # Секретный токен доступа к веб-заказу (magic link, без аккаунтов).
    access_token: Mapped[str | None] = mapped_column(String(64), unique=True, default=None)
    # ID платежа ЮKassa, ожидающего оплаты по этому заказу.
    payment_id: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    error: Mapped[str | None] = mapped_column(Text, default=None)
    # Состояние, в которое нужно вернуться при ретрае из failed.
    retry_to: Mapped[str | None] = mapped_column(String(32), default=None)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user: Mapped[User] = relationship(back_populates="jobs")
    photos: Mapped[list["Photo"]] = relationship(back_populates="job")


class FreePreview(Base):
    """Учёт бесплатных генераций на странице-приманке (антиабьюз по IP)."""

    __tablename__ = "free_previews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ip: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TeamLead(Base):
    """Заявка на командные портреты (форма B2B в блоке «Для команд»)."""

    __tablename__ = "team_leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    contact: Mapped[str] = mapped_column(Text)
    headcount: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Photo(Base):
    __tablename__ = "photos"

    SOURCE = "source"
    TEASER = "teaser"
    RESULT = "result"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16), default=SOURCE)
    # Ключ в хранилище (storage), не абсолютный путь.
    storage_key: Mapped[str] = mapped_column(Text)
    style: Mapped[str | None] = mapped_column(String(64), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    job: Mapped[Job] = relationship(back_populates="photos")

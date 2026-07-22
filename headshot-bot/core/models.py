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


class Account(Base):
    """Веб-аккаунт клиента (email + пароль). Отдельно от User (Telegram)."""

    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WebSession(Base):
    """Сессия входа: httpOnly-cookie у клиента, в БД — только хеш токена."""

    __tablename__ = "web_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AuthToken(Base):
    """Одноразовый токен: сброс пароля (reset) или подтверждение email (verify).

    Хранится только хеш; исходный токен уходит в письмо. Короткий срок жизни,
    одноразовый (used_at)."""

    __tablename__ = "auth_tokens"

    RESET = "reset"
    VERIFY = "verify"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Веб-аккаунт-владелец (если заказ оформлен из личного кабинета).
    account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id"), index=True, default=None
    )
    state: Mapped[str] = mapped_column(String(32), default=JobState.COLLECTING, index=True)
    package_code: Mapped[str | None] = mapped_column(String(32), default=None)
    # Ссылка на обученную identity-модель у провайдера (URL LoRA-весов и т.п.).
    model_ref: Mapped[str | None] = mapped_column(Text, default=None)
    # Выбранные пользователем образы (ключи стилей через запятую) — путь бота.
    styles_csv: Mapped[str | None] = mapped_column(Text, default=None)
    # Веб-конструктор: пол и ПУЛЫ выбранных ключей одежды/фона (не спаренные).
    # Воркер сам формирует N образов из пулов (compose.build_looks).
    gender: Mapped[str | None] = mapped_column(String(8), default=None)
    clothing_csv: Mapped[str | None] = mapped_column(Text, default=None)
    background_csv: Mapped[str | None] = mapped_column(Text, default=None)
    # Остаток включённых перегенераций (remix); инициализируется Package.remixes.
    remixes_left: Mapped[int] = mapped_column(Integer, default=0)
    # Канал заказа: "tg" (бот) или "web" (сайт).
    channel: Mapped[str] = mapped_column(String(8), default="tg")
    # Контакт для веб-заказов (email/телефон, как указал клиент).
    contact: Mapped[str | None] = mapped_column(Text, default=None)
    # Секретный токен доступа к веб-заказу (magic link, без аккаунтов).
    access_token: Mapped[str | None] = mapped_column(String(64), unique=True, default=None)
    # ID платежа ЮKassa, ожидающего оплаты по этому заказу.
    payment_id: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    # Первый доступ к результату в полном разрешении («скачал» для условий гарантии).
    downloaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    # Момент авто-удаления исходных фото и модели (ретеншн 30 дней, 152-ФЗ).
    purged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
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
    """Заявка на командные портреты (B2B): запрос счёта или «оплатить картой»."""

    __tablename__ = "team_leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Аккаунт-инициатор (заявка видна ему в кабинете). None — старая форма-лид.
    account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id"), index=True, default=None
    )
    company: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    contact: Mapped[str] = mapped_column(Text)
    headcount: Mapped[int] = mapped_column(Integer, default=0)
    # Способ оплаты: "invoice" (счёт) или "card" (карта/СБП).
    mode: Mapped[str | None] = mapped_column(String(16), default=None)
    total_rub: Mapped[int | None] = mapped_column(Integer, default=None)
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

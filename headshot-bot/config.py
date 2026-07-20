"""Конфигурация только из переменных окружения. Секретов в коде нет."""
import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    bot_token: str = field(default_factory=lambda: os.environ.get("BOT_TOKEN", ""))
    fal_key: str = field(default_factory=lambda: os.environ.get("FAL_KEY", ""))
    payment_provider_token: str = field(
        default_factory=lambda: os.environ.get("PAYMENT_PROVIDER_TOKEN", "")
    )
    db_url: str = field(
        default_factory=lambda: os.environ.get("DB_URL", "sqlite+aiosqlite:///data/bot.db")
    )
    data_dir: Path = field(
        default_factory=lambda: Path(os.environ.get("DATA_DIR", "data"))
    )
    # Провайдер генерации: "fal" в проде, "fake" для локальной разработки и тестов.
    provider: str = field(default_factory=lambda: os.environ.get("PROVIDER", "fake"))
    # Фиче-флаг ручного подтверждения оплаты, пока ЮKassa не подключена.
    manual_payment: bool = field(
        default_factory=lambda: os.environ.get("MANUAL_PAYMENT", "true").lower() == "true"
    )
    admin_tg_ids: tuple[int, ...] = field(
        default_factory=lambda: tuple(
            int(x) for x in os.environ.get("ADMIN_TG_IDS", "").split(",") if x.strip()
        )
    )
    # Срок хранения исходных фото и весов, дней (152-ФЗ: автоудаление).
    retention_days: int = field(
        default_factory=lambda: int(os.environ.get("RETENTION_DAYS", "30"))
    )
    min_source_photos: int = field(
        default_factory=lambda: int(os.environ.get("MIN_SOURCE_PHOTOS", "10"))
    )
    max_source_photos: int = field(
        default_factory=lambda: int(os.environ.get("MAX_SOURCE_PHOTOS", "15"))
    )
    # Публичный адрес сайта (return_url после оплаты — для любого провайдера).
    public_base_url: str = field(
        default_factory=lambda: os.environ.get("PUBLIC_BASE_URL", "https://d-portret.ru")
    )
    # Конвейер качества (включаем после тюнинга на реальных фотосессиях).
    quality_enhance: bool = field(
        default_factory=lambda: os.environ.get("QUALITY_ENHANCE", "false").lower() == "true"
    )
    quality_qc: bool = field(
        default_factory=lambda: os.environ.get("QUALITY_QC", "false").lower() == "true"
    )


def load_settings() -> Settings:
    return Settings()

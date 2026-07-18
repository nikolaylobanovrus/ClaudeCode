"""Сборка провайдера генерации по настройкам — общая для бота и веба."""
from config import Settings
from providers.base import ImageGenProvider


def make_provider(settings: Settings) -> ImageGenProvider:
    if settings.provider == "fal":
        from providers.fal_flux import FalFluxProvider

        return FalFluxProvider(settings.fal_key)
    from providers.fake import FakeProvider

    return FakeProvider()

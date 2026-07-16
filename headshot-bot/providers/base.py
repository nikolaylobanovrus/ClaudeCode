"""Абстракция над провайдером генерации изображений.

Единственная точка связи с конкретным вендором (fal.ai сейчас,
self-hosted позже): бот и воркер знают только этот интерфейс.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class GeneratedImage:
    data: bytes
    style: str


class ImageGenProvider(ABC):
    @abstractmethod
    async def teaser(self, photo: bytes, prompt: str) -> bytes:
        """Быстрый zero-shot портрет по одному селфи (бесплатный тизер)."""

    @abstractmethod
    async def train_identity(self, photos: list[bytes]) -> str:
        """Обучает identity-модель (LoRA) на селфи. Возвращает model_ref."""

    @abstractmethod
    async def generate(self, model_ref: str, prompt: str, style: str, n: int) -> list[GeneratedImage]:
        """Генерирует n портретов в заданном стиле по обученной модели."""

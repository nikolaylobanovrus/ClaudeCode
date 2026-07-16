"""Фейковый провайдер для тестов и локальной разработки без FAL_KEY.

Возвращает однотонные картинки с подписью стиля; тренировка мгновенна.
"""
import asyncio
import hashlib
from io import BytesIO

from PIL import Image

from providers.base import GeneratedImage, ImageGenProvider


def _make_image(seed: str, size: tuple[int, int] = (768, 960)) -> bytes:
    digest = hashlib.sha256(seed.encode()).digest()
    color = (digest[0], digest[1], digest[2])
    buf = BytesIO()
    Image.new("RGB", size, color).save(buf, format="JPEG")
    return buf.getvalue()


class FakeProvider(ImageGenProvider):
    def __init__(self, delay: float = 0.0):
        self.delay = delay
        self.trained_with: list[int] = []  # число фото в каждом обучении (для тестов)

    async def teaser(self, photo: bytes, prompt: str) -> bytes:
        await asyncio.sleep(self.delay)
        return _make_image(f"teaser:{prompt}:{len(photo)}")

    async def train_identity(self, photos: list[bytes]) -> str:
        await asyncio.sleep(self.delay)
        self.trained_with.append(len(photos))
        return f"fake-lora://{len(photos)}-photos"

    async def generate(self, model_ref: str, prompt: str, style: str, n: int) -> list[GeneratedImage]:
        await asyncio.sleep(self.delay)
        return [
            GeneratedImage(data=_make_image(f"{model_ref}:{style}:{i}"), style=style)
            for i in range(n)
        ]

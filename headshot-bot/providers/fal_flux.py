"""Провайдер fal.ai: Flux LoRA (тренировка + генерация) и Kontext (тизер).

Требует FAL_KEY в окружении. Эндпоинты:
- тизер:      fal-ai/flux-pro/kontext  (zero-shot редактирование по одному фото)
- тренировка: fal-ai/flux-lora-fast-training
- генерация:  fal-ai/flux-lora
"""
import asyncio
import base64
import io
import zipfile

import aiohttp

from providers.base import GeneratedImage, ImageGenProvider

TEASER_ENDPOINT = "fal-ai/flux-pro/kontext"
TRAIN_ENDPOINT = "fal-ai/flux-lora-fast-training"
GENERATE_ENDPOINT = "fal-ai/flux-lora"

# fal-client ограничивает параллелизм сам, но батчи по стилям гоняем аккуратно.
_GENERATE_BATCH = 4

# Параметры качества генерации (flux-lora). Подобраны под фотореализм портретов;
# точная настройка — по итогам контрольной съёмки.
_LORA_SCALE = 1.0           # вес обученной identity-LoRA (сходство лица)
_GUIDANCE_SCALE = 3.5       # следование промпту без «пережаренности»
_NUM_STEPS = 34             # шагов диффузии — детализация vs скорость


def _photos_zip(photos: list[bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zf:
        for i, p in enumerate(photos):
            zf.writestr(f"photo_{i:02d}.jpg", p)
    return buf.getvalue()


def _data_uri(data: bytes, mime: str = "image/jpeg") -> str:
    return f"data:{mime};base64," + base64.b64encode(data).decode()


async def _download(url: str) -> bytes:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            resp.raise_for_status()
            return await resp.read()


class FalFluxProvider(ImageGenProvider):
    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("FAL_KEY не задан")
        # fal_client читает ключ из окружения FAL_KEY; импорт здесь, чтобы
        # окружение без fal-client могло использовать FakeProvider.
        import os

        os.environ.setdefault("FAL_KEY", api_key)
        import fal_client

        self._fal = fal_client

    async def teaser(self, photo: bytes, prompt: str) -> bytes:
        result = await self._fal.run_async(
            TEASER_ENDPOINT,
            arguments={
                "image_url": _data_uri(photo),
                "prompt": prompt,
                "output_format": "jpeg",
            },
        )
        return await _download(result["images"][0]["url"])

    async def train_identity(self, photos: list[bytes]) -> str:
        archive_url = await self._fal.upload_async(_photos_zip(photos), "application/zip")
        result = await self._fal.run_async(
            TRAIN_ENDPOINT,
            arguments={
                "images_data_url": archive_url,
                "trigger_word": "TOK",
                "is_style": False,
            },
        )
        return result["diffusers_lora_file"]["url"]

    async def generate(self, model_ref: str, prompt: str, style: str, n: int) -> list[GeneratedImage]:
        images: list[GeneratedImage] = []
        remaining = n
        while remaining > 0:
            batch = min(_GENERATE_BATCH, remaining)
            result = await self._fal.run_async(
                GENERATE_ENDPOINT,
                arguments={
                    "prompt": prompt,
                    "loras": [{"path": model_ref, "scale": _LORA_SCALE}],
                    "num_images": batch,
                    "image_size": "portrait_4_3",
                    "guidance_scale": _GUIDANCE_SCALE,
                    "num_inference_steps": _NUM_STEPS,
                    "output_format": "jpeg",
                    # Портреты «в костюме» иногда ложно триггерят фильтр → чёрные кадры.
                    "enable_safety_checker": False,
                },
            )
            downloaded = await asyncio.gather(
                *(_download(img["url"]) for img in result["images"])
            )
            images.extend(GeneratedImage(data=d, style=style) for d in downloaded)
            remaining -= batch
        return images

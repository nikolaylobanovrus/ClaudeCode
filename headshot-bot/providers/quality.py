"""Конвейер качества: реставрация лиц и отбраковка кадров.

Схема как у зрелых сервисов (HeadshotPro): базовая генерация делает кадр,
затем face-restoration чистит артефакты лица, затем vision-модель решает,
достоин ли кадр доставки. Оба шага деградируют мягко: любая ошибка
внешнего API не ломает заказ — кадр проходит как есть.
"""
import base64
import logging
from typing import Protocol

import aiohttp

log = logging.getLogger(__name__)


class FaceEnhancer(Protocol):
    async def enhance(self, image: bytes) -> bytes: ...


class QualityGate(Protocol):
    async def check(self, image: bytes) -> bool: ...


class NoopEnhancer:
    async def enhance(self, image: bytes) -> bytes:
        return image


class ApproveAllQC:
    async def check(self, image: bytes) -> bool:
        return True


def _data_uri(data: bytes) -> str:
    return "data:image/jpeg;base64," + base64.b64encode(data).decode()


async def _download(url: str) -> bytes:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            resp.raise_for_status()
            return await resp.read()


class FalCodeformerEnhancer:
    """Реставрация лиц через CodeFormer на fal.ai (~$0.01/кадр)."""

    def __init__(self, endpoint: str = "fal-ai/codeformer", fidelity: float = 0.7):
        import fal_client

        self._fal = fal_client
        self.endpoint = endpoint
        # fidelity ближе к 1 — сильнее сохраняет исходные черты (важно: похожесть!)
        self.fidelity = fidelity

    async def enhance(self, image: bytes) -> bytes:
        try:
            result = await self._fal.run_async(
                self.endpoint,
                arguments={"image_url": _data_uri(image), "fidelity": self.fidelity},
            )
            return await _download(result["image"]["url"])
        except Exception:
            log.exception("Face restoration недоступна — кадр проходит без чистки")
            return image


QC_PROMPT = (
    "You are a strict photo QA inspector for a professional headshot service. "
    "Look at the image and answer with a single word. Answer BAD if the image has: "
    "deformed or asymmetric facial features, extra or malformed fingers/hands, "
    "warped glasses or teeth, text artifacts, a second face, heavy plastic-skin "
    "AI look, or a broken background. Otherwise answer GOOD."
)


class FalVisionQC:
    """Отбраковка кадров vision-моделью через fal.ai any-llm (~$0.002/кадр)."""

    def __init__(self, endpoint: str = "fal-ai/any-llm/vision", model: str | None = None):
        import fal_client

        self._fal = fal_client
        self.endpoint = endpoint
        self.model = model

    async def check(self, image: bytes) -> bool:
        try:
            args = {"prompt": QC_PROMPT, "image_url": _data_uri(image)}
            if self.model:
                args["model"] = self.model
            result = await self._fal.run_async(self.endpoint, arguments=args)
            verdict = str(result.get("output", "")).strip().upper()
            return "BAD" not in verdict
        except Exception:
            log.exception("QC недоступен — кадр одобрен по умолчанию")
            return True

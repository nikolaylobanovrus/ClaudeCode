"""Конвейер качества: реставрация, отбраковка, перегенерация."""
import pytest

from prompts.library import StyleLibrary
from providers.fake import FakeProvider
from tests.test_worker_flow import env, make_paid_job  # noqa: F401 (фикстура)
from worker import Worker


class MarkingEnhancer:
    """Помечает кадры, чтобы проверить, что реставрация применилась."""

    async def enhance(self, image: bytes) -> bytes:
        return b"ENH" + image


class RejectFirstQC:
    """Бракует первый увиденный кадр каждого стиля, остальные одобряет."""

    def __init__(self):
        self.seen_styles: set[int] = set()
        self.checked = 0

    async def check(self, image: bytes) -> bool:
        self.checked += 1
        # Первый кадр каждой десятки бракуем (кадры идут стилями по 10).
        if self.checked % 10 == 1:
            return False
        return True


class RejectAllQC:
    async def check(self, image: bytes) -> bool:
        return False


@pytest.mark.asyncio
async def test_enhancer_applied_and_rejects_regenerated(env):  # noqa: F811
    session_factory, storage = env
    await make_paid_job(session_factory, storage)
    qc = RejectFirstQC()
    delivered = {}

    async def deliver(jid, tg_id, keys):
        delivered["keys"] = keys

    worker = Worker(
        session_factory, FakeProvider(), storage, StyleLibrary.load(), deliver,
        enhancer=MarkingEnhancer(), qc=qc,
    )
    while await worker.process_one():
        pass

    assert len(delivered["keys"]) == 40  # брак заменён, пакет полный
    assert all(storage.get(k).startswith(b"ENH") for k in delivered["keys"])
    assert qc.checked > 40  # были дополнительные проверки перегенерации


@pytest.mark.asyncio
async def test_all_rejected_still_delivers_full_package(env):  # noqa: F811
    """Если QC бракует всё (сломался/слишком строг) — доставляем лучшее из
    имеющегося, а не пустоту: доставка важнее совершенства."""
    session_factory, storage = env
    await make_paid_job(session_factory, storage)
    delivered = {}

    async def deliver(jid, tg_id, keys):
        delivered["keys"] = keys

    worker = Worker(
        session_factory, FakeProvider(), storage, StyleLibrary.load(), deliver,
        qc=RejectAllQC(),
    )
    while await worker.process_one():
        pass

    assert len(delivered["keys"]) == 40

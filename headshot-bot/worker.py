"""Фоновый воркер: двигает заказы по конвейеру training → generating → delivering.

Каждый вызов process_one() выполняет ровно один шаг одного заказа —
это упрощает тесты и делает ретраи предсказуемыми. Ошибка шага
переводит заказ в failed с retry_to; до MAX_ATTEMPTS воркер
возвращает его в работу автоматически.
"""
import asyncio
import logging
from typing import Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from core.models import Job, Photo
from core.packages import get_package
from core.states import WORKER_STATES, JobState, validate_transition
from prompts.compose import compose_looks
from prompts.library import StyleLibrary
from prompts.wardrobe import WardrobeLibrary
from providers.base import ImageGenProvider
from providers.quality import ApproveAllQC, FaceEnhancer, NoopEnhancer, QualityGate
from storage.files import FileStorage

log = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
# Сколько дополнительных заходов генерации разрешено на стиль, чтобы
# заменить отбракованные QC кадры (защита от бесконечного цикла и расхода).
MAX_QC_REGEN_ROUNDS = 1

# Колбэк доставки: (job_id, tg_id, ключи готовых фото) -> None
DeliverFn = Callable[[int, int, list[str]], Awaitable[None]]


class Worker:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        provider: ImageGenProvider,
        storage: FileStorage,
        styles: StyleLibrary,
        deliver: DeliverFn,
        poll_interval: float = 3.0,
        enhancer: FaceEnhancer | None = None,
        qc: QualityGate | None = None,
        wardrobe: WardrobeLibrary | None = None,
    ):
        self.session_factory = session_factory
        self.provider = provider
        self.storage = storage
        self.styles = styles
        self.deliver = deliver
        self.poll_interval = poll_interval
        self.enhancer = enhancer or NoopEnhancer()
        self.qc = qc or ApproveAllQC()
        self.wardrobe = wardrobe or WardrobeLibrary.load()

    async def run_forever(self) -> None:
        while True:
            try:
                worked = await self.process_one()
            except Exception:
                log.exception("Неперехваченная ошибка воркера")
                worked = False
            if not worked:
                await asyncio.sleep(self.poll_interval)

    async def process_one(self) -> bool:
        """Выполняет один шаг: True, если был заказ в работе."""
        async with self.session_factory() as session:
            job = await self._pick_job(session)
            if job is None:
                return False
            try:
                await self._step(session, job)
            except Exception as exc:
                log.exception("Заказ %s: ошибка на шаге %s", job.id, job.state)
                await self._fail(session, job, exc)
            return True

    async def _pick_job(self, session: AsyncSession) -> Job | None:
        stmt = (
            select(Job)
            .where(Job.state.in_([s.value for s in WORKER_STATES]))
            .order_by(Job.updated_at)
            .limit(1)
        )
        job = (await session.execute(stmt)).scalar_one_or_none()
        if job is not None:
            return job
        # Автовозврат упавших заказов, у которых остались попытки.
        stmt = (
            select(Job)
            .where(Job.state == JobState.FAILED, Job.attempts < MAX_ATTEMPTS)
            .order_by(Job.updated_at)
            .limit(1)
        )
        failed = (await session.execute(stmt)).scalar_one_or_none()
        if failed is not None and failed.retry_to:
            failed.state = validate_transition(
                JobState(failed.state), JobState(failed.retry_to)
            )
            await session.commit()
            return failed
        return None

    async def _step(self, session: AsyncSession, job: Job) -> None:
        state = JobState(job.state)
        if state is JobState.TRAINING:
            await self._do_training(session, job)
        elif state is JobState.GENERATING:
            await self._do_generating(session, job)
        elif state is JobState.DELIVERING:
            await self._do_delivering(session, job)

    async def _do_training(self, session: AsyncSession, job: Job) -> None:
        photos = await self._load_photos(session, job.id, Photo.SOURCE)
        job.model_ref = await self.provider.train_identity(photos)
        job.state = validate_transition(JobState(job.state), JobState.GENERATING)
        await session.commit()

    async def _do_generating(self, session: AsyncSession, job: Job) -> None:
        package = get_package(job.package_code)
        per_style = package.portraits_per_style()
        if job.clothing_csv and job.background_csv:
            # Веб-конструктор: собираем N образов из пулов одежды/фона.
            clothing = self.wardrobe.resolve(
                "clothing", job.clothing_csv.split(","), job.gender)
            backgrounds = self.wardrobe.resolve(
                "background", job.background_csv.split(","))
            chosen = compose_looks(job.gender or "person", clothing, backgrounds, package.styles)
        elif job.styles_csv:
            chosen = self.styles.resolve(job.styles_csv.split(","))
        else:
            chosen = self.styles.for_package(package.styles)
        for style in chosen:
            done_stmt = select(Photo).where(
                Photo.job_id == job.id, Photo.kind == Photo.RESULT, Photo.style == style.key
            )
            if len((await session.execute(done_stmt)).scalars().all()) >= per_style:
                continue  # стиль уже готов (ретрай после сбоя) — не генерируем повторно
            accepted = await self._generate_with_qc(job, style, per_style)
            for i, data in enumerate(accepted):
                key = self.storage.put(
                    f"jobs/{job.id}/{Photo.RESULT}/{style.key}_{i:02d}.jpg", data
                )
                session.add(
                    Photo(job_id=job.id, kind=Photo.RESULT, storage_key=key, style=style.key)
                )
            await session.commit()  # фиксируем по стилям: ретрай не потеряет готовое
        job.state = validate_transition(JobState(job.state), JobState.DELIVERING)
        await session.commit()

    async def _generate_with_qc(self, job: Job, style, per_style: int) -> list[bytes]:
        """Генерация с конвейером качества: реставрация лиц → отбраковка →
        одна волна перегенерации взамен брака. Если брак остался и после неё,
        добираем лучшими из отбракованных — доставка важнее совершенства."""
        accepted: list[bytes] = []
        rejected: list[bytes] = []
        need = per_style
        for round_no in range(1 + MAX_QC_REGEN_ROUNDS):
            if need <= 0:
                break
            images = await self.provider.generate(job.model_ref, style.prompt, style.key, need)
            for img in images:
                data = await self.enhancer.enhance(img.data)
                if await self.qc.check(data):
                    accepted.append(data)
                else:
                    rejected.append(data)
            need = per_style - len(accepted)
            if need > 0 and round_no < MAX_QC_REGEN_ROUNDS:
                log.info(
                    "Заказ %s, стиль %s: QC отбраковал %d кадров, перегенерация",
                    job.id, style.key, need,
                )
        if need > 0:
            accepted.extend(rejected[:need])
        return accepted[:per_style]

    async def _do_delivering(self, session: AsyncSession, job: Job) -> None:
        stmt = select(Photo).where(Photo.job_id == job.id, Photo.kind == Photo.RESULT)
        result_keys = [p.storage_key for p in (await session.execute(stmt)).scalars()]
        user_tg_id = (await job.awaitable_attrs.user).tg_id
        await self.deliver(job.id, user_tg_id, result_keys)
        job.state = validate_transition(JobState(job.state), JobState.DONE)
        await session.commit()

    async def _load_photos(self, session: AsyncSession, job_id: int, kind: str) -> list[bytes]:
        stmt = select(Photo).where(Photo.job_id == job_id, Photo.kind == kind)
        photos = (await session.execute(stmt)).scalars().all()
        return [self.storage.get(p.storage_key) for p in photos]

    async def _fail(self, session: AsyncSession, job: Job, exc: Exception) -> None:
        job.retry_to = job.state
        job.state = JobState.FAILED
        job.error = f"{type(exc).__name__}: {exc}"
        job.attempts += 1
        await session.commit()

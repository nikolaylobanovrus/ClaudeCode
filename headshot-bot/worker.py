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
from prompts.library import StyleLibrary
from providers.base import ImageGenProvider
from storage.files import FileStorage

log = logging.getLogger(__name__)

MAX_ATTEMPTS = 3

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
    ):
        self.session_factory = session_factory
        self.provider = provider
        self.storage = storage
        self.styles = styles
        self.deliver = deliver
        self.poll_interval = poll_interval

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
        if job.styles_csv:
            chosen = self.styles.resolve(job.styles_csv.split(","))
        else:
            chosen = self.styles.for_package(package.styles)
        for style in chosen:
            done_stmt = select(Photo).where(
                Photo.job_id == job.id, Photo.kind == Photo.RESULT, Photo.style == style.key
            )
            if len((await session.execute(done_stmt)).scalars().all()) >= per_style:
                continue  # стиль уже готов (ретрай после сбоя) — не генерируем повторно
            images = await self.provider.generate(
                job.model_ref, style.prompt, style.key, per_style
            )
            for i, img in enumerate(images):
                key = self.storage.put(
                    f"jobs/{job.id}/{Photo.RESULT}/{style.key}_{i:02d}.jpg", img.data
                )
                session.add(
                    Photo(job_id=job.id, kind=Photo.RESULT, storage_key=key, style=style.key)
                )
            await session.commit()  # фиксируем по стилям: ретрай не потеряет готовое
        job.state = validate_transition(JobState(job.state), JobState.DELIVERING)
        await session.commit()

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

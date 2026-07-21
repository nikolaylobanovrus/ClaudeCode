"""Авто-удаление персональных данных по сроку хранения (152-ФЗ).

Политика: загруженные фотографии и обученная модель хранятся не более
RETENTION_DAYS (30) дней. По истечении срока исходные селфи стираются с
диска, записи о них удаляются, ссылка на модель обнуляется. Готовые
портреты (оплаченный результат) не трогаем — они не относятся к сроку
хранения исходников по тексту политики.
"""
import logging
from datetime import timedelta

from sqlalchemy import select

from core.models import Job, Photo, utcnow

log = logging.getLogger("retention")


async def purge_expired(session_factory, storage, retention_days: int) -> int:
    """Чистит заказы старше retention_days. Возвращает число очищенных."""
    cutoff = utcnow() - timedelta(days=retention_days)
    purged = 0
    async with session_factory() as session:
        jobs = (await session.execute(
            select(Job).where(Job.created_at < cutoff, Job.purged_at.is_(None))
        )).scalars().all()
        for job in jobs:
            sources = (await session.execute(
                select(Photo).where(Photo.job_id == job.id, Photo.kind == Photo.SOURCE)
            )).scalars().all()
            for photo in sources:
                try:
                    storage.delete(photo.storage_key)
                except Exception:
                    log.exception("Не удалось удалить файл %s", photo.storage_key)
                await session.delete(photo)
            job.model_ref = None
            job.purged_at = utcnow()
            purged += 1
        await session.commit()
    if purged:
        log.info("Ретеншн: очищено заказов — %d (старше %d дней)", purged, retention_days)
    return purged

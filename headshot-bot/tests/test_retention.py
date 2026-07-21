"""Авто-удаление исходных фото по сроку хранения (152-ФЗ)."""
from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from core.db import init_db
from core.models import Job, Photo, User, utcnow
from core.retention import purge_expired
from storage.files import FileStorage


@pytest.mark.asyncio
async def test_purge_removes_sources_keeps_results(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/ret.db")
    await init_db(engine)
    sf = async_sessionmaker(engine, expire_on_commit=False)
    storage = FileStorage(tmp_path / "files")

    async with sf() as session:
        user = User(tg_id=-1)
        session.add(user)
        await session.flush()
        # Старый заказ (40 дней) с исходником и результатом + свежий заказ.
        old = Job(user_id=user.id, state="done", model_ref="lora://weights")
        new = Job(user_id=user.id, state="done", model_ref="lora://weights2")
        session.add_all([old, new])
        await session.flush()
        old.created_at = utcnow() - timedelta(days=40)
        src_key = storage.put(f"jobs/{old.id}/source/00.jpg", b"selfie")
        res_key = storage.put(f"jobs/{old.id}/result/00.jpg", b"portrait")
        new_src = storage.put(f"jobs/{new.id}/source/00.jpg", b"fresh")
        session.add_all([
            Photo(job_id=old.id, kind=Photo.SOURCE, storage_key=src_key),
            Photo(job_id=old.id, kind=Photo.RESULT, storage_key=res_key),
            Photo(job_id=new.id, kind=Photo.SOURCE, storage_key=new_src),
        ])
        await session.commit()
        old_id, new_id = old.id, new.id

    n = await purge_expired(sf, storage, retention_days=30)
    assert n == 1

    # Исходник старого заказа удалён, результат — на месте.
    assert not storage.exists(src_key)
    assert storage.exists(res_key)
    # Свежий заказ не тронут.
    assert storage.exists(new_src)

    async with sf() as session:
        old = await session.get(Job, old_id)
        assert old.model_ref is None
        assert old.purged_at is not None
        srcs = (await session.execute(
            select(Photo).where(Photo.job_id == old_id, Photo.kind == Photo.SOURCE)
        )).scalars().all()
        assert srcs == []
        results = (await session.execute(
            select(Photo).where(Photo.job_id == old_id, Photo.kind == Photo.RESULT)
        )).scalars().all()
        assert len(results) == 1
        new = await session.get(Job, new_id)
        assert new.purged_at is None

    # Повторный прогон ничего не чистит (idempotent).
    assert await purge_expired(sf, storage, retention_days=30) == 0
    await engine.dispose()

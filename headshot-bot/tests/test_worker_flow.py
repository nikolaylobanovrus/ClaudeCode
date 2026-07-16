"""E2E конвейера на FakeProvider: оплата подтверждена → done с доставкой."""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from core.db import init_db
from core.models import Base, Job, Photo, User
from core.packages import get_package
from core.states import JobState
from prompts.library import StyleLibrary
from providers.fake import FakeProvider, _make_image
from storage.files import FileStorage
from worker import MAX_ATTEMPTS, Worker


@pytest_asyncio.fixture
async def env(tmp_path):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    await init_db(engine)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    storage = FileStorage(tmp_path / "files")
    yield session_factory, storage
    await engine.dispose()


async def make_paid_job(session_factory, storage, package_code="standard") -> int:
    async with session_factory() as session:
        user = User(tg_id=111)
        session.add(user)
        await session.flush()
        job = Job(user_id=user.id, state=JobState.TRAINING, package_code=package_code)
        session.add(job)
        await session.flush()
        for i in range(10):
            key = storage.put(f"jobs/{job.id}/source/{i:02d}.jpg", _make_image(f"src{i}"))
            session.add(Photo(job_id=job.id, kind=Photo.SOURCE, storage_key=key))
        await session.commit()
        return job.id


@pytest.mark.asyncio
async def test_full_pipeline_delivers_package(env):
    session_factory, storage = env
    job_id = await make_paid_job(session_factory, storage)
    provider = FakeProvider()
    delivered = {}

    async def deliver(jid, tg_id, keys):
        delivered.update(job=jid, tg=tg_id, keys=keys)

    worker = Worker(session_factory, provider, storage, StyleLibrary.load(), deliver)
    for _ in range(3):  # training -> generating -> delivering
        assert await worker.process_one()
    assert not await worker.process_one()  # очередь пуста

    package = get_package("standard")
    assert delivered["job"] == job_id
    assert delivered["tg"] == 111
    assert len(delivered["keys"]) == package.portraits
    assert all(storage.exists(k) for k in delivered["keys"])
    assert provider.trained_with == [10]

    async with session_factory() as session:
        job = await session.get(Job, job_id)
        assert JobState(job.state) is JobState.DONE
        assert job.model_ref.startswith("fake-lora://")


@pytest.mark.asyncio
async def test_generation_respects_chosen_styles(env):
    session_factory, storage = env
    chosen = ["hh_white", "office_modern", "suit_navy", "business_casual"]
    job_id = await make_paid_job(session_factory, storage)
    async with session_factory() as session:
        job = await session.get(Job, job_id)
        job.styles_csv = ",".join(chosen)
        await session.commit()

    delivered = {}

    async def deliver(jid, tg_id, keys):
        delivered["keys"] = keys

    worker = Worker(session_factory, FakeProvider(), storage, StyleLibrary.load(), deliver)
    while await worker.process_one():
        pass

    package = get_package("standard")
    assert len(delivered["keys"]) == package.portraits
    used_styles = {k.rsplit("/", 1)[-1].rsplit("_", 1)[0] for k in delivered["keys"]}
    assert used_styles == set(chosen)


def test_style_library_resolve():
    lib = StyleLibrary.load()
    keys = [s.key for s in lib.styles[:3]]
    assert [s.key for s in lib.resolve(list(reversed(keys)))] == keys  # порядок библиотеки
    with pytest.raises(ValueError):
        lib.resolve(["nonexistent_style"])


@pytest.mark.asyncio
async def test_failure_retries_then_gives_up(env):
    session_factory, storage = env
    await make_paid_job(session_factory, storage)

    class BrokenProvider(FakeProvider):
        async def train_identity(self, photos):
            raise RuntimeError("GPU on fire")

    async def deliver(jid, tg_id, keys):
        raise AssertionError("не должно дойти до доставки")

    worker = Worker(session_factory, BrokenProvider(), storage, StyleLibrary.load(), deliver)
    # Каждая пара шагов: (ретрай в training) + падение. Первый заход без ретрая.
    steps = 0
    while await worker.process_one():
        steps += 1
        assert steps < 20, "воркер зациклился"

    async with session_factory() as session:
        job = (await session.execute(Job.__table__.select())).one()
        assert job.state == JobState.FAILED
        assert job.attempts == MAX_ATTEMPTS
        assert "GPU on fire" in job.error
        assert job.retry_to == JobState.TRAINING


@pytest.mark.asyncio
async def test_generation_is_resumable_per_style(env):
    """Падение на втором стиле не теряет результаты первого."""
    session_factory, storage = env
    await make_paid_job(session_factory, storage)

    class FlakyProvider(FakeProvider):
        def __init__(self):
            super().__init__()
            self.calls = 0

        async def generate(self, model_ref, prompt, style, n):
            self.calls += 1
            if self.calls == 2:
                raise RuntimeError("временный сбой")
            return await super().generate(model_ref, prompt, style, n)

    delivered = {}

    async def deliver(jid, tg_id, keys):
        delivered["keys"] = keys

    worker = Worker(session_factory, FlakyProvider(), storage, StyleLibrary.load(), deliver)
    while await worker.process_one():
        pass

    package = get_package("standard")
    # После ретрая готовые стили не генерируются повторно, дублей нет.
    assert len(delivered["keys"]) == package.portraits
    assert len(set(delivered["keys"])) == package.portraits

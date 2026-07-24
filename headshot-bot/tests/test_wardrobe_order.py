"""Веб-заказ через конструктор образов (пол → пул одежды → пул фонов).

Проверяет: /api/wardrobe отдаёт каталог; create_order валидирует пол/пулы;
воркер собирает ровно package.portraits кадров по N образам из пулов.
"""
from io import BytesIO

import pytest
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from core.models import Photo
from core.packages import get_package
from prompts.library import StyleLibrary
from prompts.wardrobe import WardrobeLibrary
from providers.fake import FakeProvider
from storage.files import FileStorage
from worker import Worker


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("PROVIDER", "fake")
    monkeypatch.setenv("PAYMENT_STUB", "true")
    monkeypatch.setenv("DB_URL", f"sqlite+aiosqlite:///{tmp_path}/w.db")
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    from fastapi.testclient import TestClient

    from web.app import app
    with TestClient(app) as c:
        c.tmp_path = tmp_path
        yield c


def make_photo() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (768, 1024), (120, 110, 100)).save(buf, format="JPEG")
    return buf.getvalue()


_LIB = WardrobeLibrary.load()


def _pools(gender="male", n_cl=4, n_bg=3):
    cl = ",".join(c.key for c in _LIB.clothing(gender)[:n_cl])
    bg = ",".join(b.key for b in _LIB.backgrounds()[:n_bg])
    return cl, bg


def test_wardrobe_endpoint(client):
    r = client.get("/api/wardrobe", params={"kind": "clothing", "gender": "female"})
    assert r.status_code == 200
    body = r.json()
    assert body["categories"]
    assert len(body["items"]) >= 90
    it = body["items"][0]
    assert set(it) == {"key", "label", "category", "thumb"}
    assert it["thumb"].startswith("/static/img/wardrobe/clothing/")

    # Фон: превью с моделью по полу — путь содержит /background/{gender}/.
    rm = client.get("/api/wardrobe", params={"kind": "background", "gender": "male"})
    assert rm.status_code == 200
    assert rm.json()["items"][0]["thumb"].startswith("/static/img/wardrobe/background/male/")
    rf = client.get("/api/wardrobe", params={"kind": "background", "gender": "female"})
    assert rf.json()["items"][0]["thumb"].startswith("/static/img/wardrobe/background/female/")

    assert client.get("/api/wardrobe", params={"kind": "nope"}).status_code == 422
    assert client.get("/api/wardrobe",
                      params={"kind": "clothing", "gender": "x"}).status_code == 422


def test_create_order_validates_wardrobe(client):
    cl, bg = _pools()
    base = {"package": "standard", "contact": "a@b.ru", "consent": "yes"}

    # Плохой пол.
    assert client.post("/api/orders", data={**base, "gender": "x",
                       "clothing": cl, "backgrounds": bg}).status_code == 422
    # Чужой ключ одежды.
    assert client.post("/api/orders", data={**base, "gender": "male",
                       "clothing": "no_such", "backgrounds": bg}).status_code == 422
    # Пустой пул фонов.
    assert client.post("/api/orders", data={**base, "gender": "male",
                       "clothing": cl, "backgrounds": ""}).status_code == 422
    # Пул мал: 1×1 = 1 < 4 образов Стандарта.
    one_cl = _LIB.clothing("male")[0].key
    one_bg = _LIB.backgrounds()[0].key
    assert client.post("/api/orders", data={**base, "gender": "male",
                       "clothing": one_cl, "backgrounds": one_bg}).status_code == 422
    # Женский ключ при gender=male.
    fem = _LIB.clothing("female")[0].key
    assert client.post("/api/orders", data={**base, "gender": "male",
                       "clothing": fem, "backgrounds": bg}).status_code == 422

    # Корректный заказ — создаётся черновик (селфи-первый флоу, оплата позже).
    r = client.post("/api/orders", data={**base, "gender": "male",
                    "clothing": cl, "backgrounds": bg})
    assert r.status_code == 200, r.text
    assert r.json()["state"] == "collecting"


@pytest.mark.asyncio
async def test_worker_wardrobe_produces_all_portraits(tmp_path):
    import os
    db = f"sqlite+aiosqlite:///{tmp_path}/w.db"
    os.environ["PROVIDER"] = "fake"
    os.environ["PAYMENT_STUB"] = "true"
    os.environ["DB_URL"] = db
    os.environ["DATA_DIR"] = str(tmp_path / "data")
    from fastapi.testclient import TestClient

    from web.app import app

    with TestClient(app) as client:
        cl, bg = _pools(gender="female", n_cl=4, n_bg=3)  # 12 ≥ 7 образов Оптимального
        r = client.post("/api/orders", data={
            "package": "pro", "contact": "a@b.ru", "consent": "yes",
            "gender": "female", "clothing": cl, "backgrounds": bg})
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        photo = make_photo()
        for i in range(10):
            client.post(f"/api/orders/{token}/photos",
                        files={"photo": (f"p{i}.jpg", photo, "image/jpeg")})
        # Селфи-первый флоу: оплата (заглушка) после загрузки → генерация.
        assert client.post(f"/api/orders/{token}/checkout",
                           data={"contact": "a@b.ru"}).status_code == 200

        engine = create_async_engine(db)
        sf = async_sessionmaker(engine, expire_on_commit=False)

        async def deliver(jid, tg_id, keys):
            pass

        storage = FileStorage(tmp_path / "data" / "files")
        worker = Worker(sf, FakeProvider(), storage, StyleLibrary.load(), deliver)
        while await worker.process_one():
            pass

        status = client.get(f"/api/orders/{token}").json()
        assert status["state"] == "done"
        pkg = get_package("pro")
        assert len(status["results"]) == pkg.portraits  # 70

        # Кадры разложены ровно по N=7 образам (look-ключи), по 10 на образ.
        async with sf() as session:
            rows = (await session.execute(
                select(Photo.style).where(Photo.kind == Photo.RESULT))).scalars().all()
        looks = {s for s in rows}
        assert len(looks) == pkg.styles  # 7 уникальных образов
        assert all(s.startswith("look") for s in looks)
        await engine.dispose()

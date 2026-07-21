"""E2E веб-заказа (флоу как у HeadshotPro): тариф → оплата → фото → образы → галерея.

В тестах включена заглушка оплаты (PAYMENT_STUB): заказ создаётся сразу
оплаченным (state=collecting), минуя ЮKassa.
"""
from io import BytesIO

import pytest
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from core.models import Job
from prompts.library import StyleLibrary
from providers.fake import FakeProvider
from storage.files import FileStorage
from worker import Worker


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("PROVIDER", "fake")
    monkeypatch.setenv("PAYMENT_STUB", "true")
    monkeypatch.setenv("DB_URL", f"sqlite+aiosqlite:///{tmp_path}/order.db")
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


def create_paid_order(client, contact="a@b.ru", package="standard") -> str:
    """Создаёт заказ с тарифом; заглушка оплаты сразу переводит в collecting."""
    resp = client.post(
        "/api/orders",
        data={"package": package, "contact": contact, "consent": "yes"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["paid"] is True
    return body["token"]


def test_full_web_order(client):
    # Заказ нельзя создать без согласия и без валидного тарифа.
    assert client.post(
        "/api/orders", data={"package": "standard", "contact": "a@b.ru"}
    ).status_code == 400
    assert client.post(
        "/api/orders", data={"package": "nope", "contact": "a@b.ru", "consent": "yes"}
    ).status_code == 422

    token = create_paid_order(client)
    # Оплачен → сбор фото.
    assert client.get(f"/api/orders/{token}").json()["state"] == "collecting"

    # Запуск генерации нельзя без 10 фото.
    resp = client.post(
        f"/api/orders/{token}/generate",
        data={"styles": "studio_grey,hh_white,office_modern,suit_navy"},
    )
    assert resp.status_code == 409

    # Загрузка 10 фото.
    photo = make_photo()
    for i in range(10):
        resp = client.post(
            f"/api/orders/{token}/photos",
            files={"photo": (f"p{i}.jpg", photo, "image/jpeg")},
        )
        assert resp.status_code == 200, resp.text
    assert client.get(f"/api/orders/{token}").json()["photos"] == 10

    # Неверное число образов — отказ; правильное — генерация запущена.
    resp = client.post(
        f"/api/orders/{token}/generate", data={"styles": "studio_grey,hh_white"}
    )
    assert resp.status_code == 422
    resp = client.post(
        f"/api/orders/{token}/generate",
        data={"styles": "studio_grey,hh_white,office_modern,suit_navy"},
    )
    assert resp.status_code == 200
    assert client.get(f"/api/orders/{token}").json()["state"] == "training"

    # Повторный запуск на уже не-collecting заказе не ломает (не 500).
    resp = client.post(
        f"/api/orders/{token}/generate",
        data={"styles": "studio_grey,hh_white,office_modern,suit_navy"},
    )
    assert resp.status_code in (404, 409)


@pytest.mark.asyncio
async def test_worker_completes_web_order(tmp_path):
    """Оплаченный веб-заказ проходит конвейер, галерея отдаёт результаты."""
    db = f"sqlite+aiosqlite:///{tmp_path}/order.db"
    import os

    os.environ["PROVIDER"] = "fake"
    os.environ["PAYMENT_STUB"] = "true"
    os.environ["DB_URL"] = db
    os.environ["DATA_DIR"] = str(tmp_path / "data")
    from fastapi.testclient import TestClient

    from web.app import app

    with TestClient(app) as client:
        token = create_paid_order(client, contact="+79990000000")
        photo = make_photo()
        for i in range(10):
            client.post(
                f"/api/orders/{token}/photos",
                files={"photo": (f"p{i}.jpg", photo, "image/jpeg")},
            )
        client.post(
            f"/api/orders/{token}/generate",
            data={"styles": "studio_grey,hh_white,office_modern,suit_navy"},
        )
        assert client.get(f"/api/orders/{token}").json()["state"] == "training"

        engine = create_async_engine(db)
        sf = async_sessionmaker(engine, expire_on_commit=False)
        delivered = {}

        async def deliver(jid, tg_id, keys):
            delivered["tg"] = tg_id  # для веб-заказов доставки в TG нет

        storage = FileStorage(tmp_path / "data" / "files")
        worker = Worker(sf, FakeProvider(), storage, StyleLibrary.load(), deliver)
        while await worker.process_one():
            pass
        await engine.dispose()

        status = client.get(f"/api/orders/{token}").json()
        assert status["state"] == "done"
        assert len(status["results"]) == 40
        assert delivered["tg"] < 0  # синтетический веб-пользователь

        img = client.get(status["results"][0]["url"])
        assert img.status_code == 200
        assert img.headers["content-type"] == "image/jpeg"

        # Чужой/битый токен не даёт доступа.
        assert client.get("/api/orders/wrongtoken").status_code == 404


@pytest.mark.asyncio
async def test_full_res_access_sets_downloaded_at(tmp_path):
    """Превью не фиксирует получение результата, полный размер — фиксирует."""
    import os
    os.environ["PROVIDER"] = "fake"
    os.environ["PAYMENT_STUB"] = "true"
    os.environ["DB_URL"] = f"sqlite+aiosqlite:///{tmp_path}/dl.db"
    os.environ["DATA_DIR"] = str(tmp_path / "data")
    from fastapi.testclient import TestClient

    from web.app import app

    with TestClient(app) as client:
        token = create_paid_order(client)
        photo = make_photo()
        for i in range(10):
            client.post(f"/api/orders/{token}/photos",
                        files={"photo": (f"p{i}.jpg", photo, "image/jpeg")})
        client.post(f"/api/orders/{token}/generate",
                    data={"styles": "studio_grey,hh_white,office_modern,suit_navy"})

        db = f"sqlite+aiosqlite:///{tmp_path}/dl.db"
        engine = create_async_engine(db)
        sf = async_sessionmaker(engine, expire_on_commit=False)

        async def deliver(jid, tg_id, keys):
            pass

        storage = FileStorage(tmp_path / "data" / "files")
        worker = Worker(sf, FakeProvider(), storage, StyleLibrary.load(), deliver)
        while await worker.process_one():
            pass

        status = client.get(f"/api/orders/{token}").json()
        url = status["results"][0]["url"]

        # Превью: маленькое, downloaded_at не ставится.
        preview = client.get(url)
        assert preview.status_code == 200
        async with sf() as session:
            job = (await session.execute(select(Job))).scalar_one()
            assert job.downloaded_at is None

        # Полный размер: больше превью, фиксирует downloaded_at.
        fullres = client.get(url + "?full=1")
        assert fullres.status_code == 200
        assert len(fullres.content) != len(preview.content)
        async with sf() as session:
            job = (await session.execute(select(Job))).scalar_one()
            assert job.downloaded_at is not None
        await engine.dispose()

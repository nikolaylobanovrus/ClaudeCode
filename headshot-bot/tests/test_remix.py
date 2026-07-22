"""Remix готового заказа: списание credit, воркер добирает новый кадр."""
from io import BytesIO

import pytest
from PIL import Image
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from prompts.library import StyleLibrary
from prompts.wardrobe import WardrobeLibrary
from providers.fake import FakeProvider
from storage.files import FileStorage
from worker import Worker

_LIB = WardrobeLibrary.load()


def make_photo() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (768, 1024), (120, 110, 100)).save(buf, format="JPEG")
    return buf.getvalue()


def _pools(gender="male", n_cl=4, n_bg=3):
    cl = ",".join(c.key for c in _LIB.clothing(gender)[:n_cl])
    bg = ",".join(b.key for b in _LIB.backgrounds()[:n_bg])
    return cl, bg


@pytest.mark.asyncio
async def test_remix_flow(tmp_path):
    import os
    db = f"sqlite+aiosqlite:///{tmp_path}/rx.db"
    os.environ["PROVIDER"] = "fake"
    os.environ["PAYMENT_STUB"] = "true"
    os.environ["DB_URL"] = db
    os.environ["DATA_DIR"] = str(tmp_path / "data")
    from fastapi.testclient import TestClient

    from web.app import app

    with TestClient(app) as client:
        cl, bg = _pools("male", 4, 3)
        token = client.post("/api/orders", data={
            "package": "standard", "contact": "a@b.ru", "consent": "yes",
            "gender": "male", "clothing": cl, "backgrounds": bg}).json()["token"]
        photo = make_photo()
        for i in range(10):
            client.post(f"/api/orders/{token}/photos",
                        files={"photo": (f"p{i}.jpg", photo, "image/jpeg")})
        client.post(f"/api/orders/{token}/generate")

        engine = create_async_engine(db)
        sf = async_sessionmaker(engine, expire_on_commit=False)

        async def deliver(jid, tg_id, keys):
            pass

        storage = FileStorage(tmp_path / "data" / "files")
        worker = Worker(sf, FakeProvider(), storage, StyleLibrary.load(), deliver)
        while await worker.process_one():
            pass

        st = client.get(f"/api/orders/{token}").json()
        assert st["state"] == "done"
        assert st["remixes_left"] == 2  # Стандарт: 2 remix
        base = len(st["results"])
        source = st["results"][0]["style"]

        # Плохой режим / чужой источник — отклоняются.
        assert client.post(f"/api/orders/{token}/remix",
                           data={"source": source, "mode": "nope"}).status_code == 422
        assert client.post(f"/api/orders/{token}/remix",
                           data={"source": "look9_x__y", "mode": "regen"}).status_code == 422

        # Сменить фон: новый ключ фона.
        new_bg = _LIB.backgrounds()[5].key
        r = client.post(f"/api/orders/{token}/remix", data={
            "source": source, "mode": "background", "background": new_bg})
        assert r.status_code == 200, r.text
        assert r.json()["remixes_left"] == 1

        # Перегенерация — второй credit.
        r = client.post(f"/api/orders/{token}/remix",
                        data={"source": source, "mode": "regen"})
        assert r.json()["remixes_left"] == 0

        # Credits кончились — 409.
        assert client.post(f"/api/orders/{token}/remix",
                           data={"source": source, "mode": "regen"}).status_code == 409

        # Воркер добирает 2 новых кадра.
        while await worker.process_one():
            pass
        st2 = client.get(f"/api/orders/{token}").json()
        assert len(st2["results"]) == base + 2
        new_styles = [p["style"] for p in st2["results"] if p["style"].startswith("remix")]
        assert len(new_styles) == 2
        # У «сменить фон» новый фон присутствует в ключе кадра.
        assert any(new_bg in s for s in new_styles)
        await engine.dispose()

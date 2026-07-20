"""Веб: страницы, API и бесплатное превью с лимитом по IP."""
from io import BytesIO

import pytest
from PIL import Image


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("PROVIDER", "fake")
    monkeypatch.setenv("DB_URL", f"sqlite+aiosqlite:///{tmp_path}/web.db")
    from fastapi.testclient import TestClient

    from web.app import app

    with TestClient(app) as c:
        yield c


def make_photo(size=(768, 1024), color=(128, 110, 100)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, color).save(buf, format="JPEG")
    return buf.getvalue()


def test_pages_and_api(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert "Деловой" in client.get("/").text
    assert "Бесплатно" in client.get("/free").text
    assert len(client.get("/api/styles").json()) == 8
    assert {p["code"] for p in client.get("/api/packages").json()} == {"standard", "pro", "max"}


def test_free_preview_flow_and_daily_limit(client):
    files = {"photo": ("selfie.jpg", make_photo(), "image/jpeg")}

    # Без согласия — отказ.
    resp = client.post("/api/free-preview", files=files)
    assert resp.status_code == 400

    # Успешная генерация.
    resp = client.post("/api/free-preview", files=files, data={"consent": "yes"})
    assert resp.status_code == 200
    assert resp.json()["image"].startswith("data:image/jpeg;base64,")

    # Второй раз с того же IP в тот же день — лимит.
    resp = client.post("/api/free-preview", files=files, data={"consent": "yes"})
    assert resp.status_code == 429
    assert resp.json()["error"] == "daily_limit"


def test_free_preview_rejects_bad_photo(client):
    files = {"photo": ("x.jpg", b"not a jpeg", "image/jpeg")}
    resp = client.post("/api/free-preview", files=files, data={"consent": "yes"})
    assert resp.status_code == 422
    assert resp.json()["error"] == "not_an_image"

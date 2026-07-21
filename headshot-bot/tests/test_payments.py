"""Оплата ЮKassa: платёж создаётся при оформлении заказа (тариф → оплата),
вебхук переводит оплаченный заказ к сбору фото (collecting)."""
from io import BytesIO

import pytest
from PIL import Image

from core.payments import Payment, customer_from_contact


def make_photo() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (768, 1024), (120, 110, 100)).save(buf, format="JPEG")
    return buf.getvalue()


class StubPayments:
    def __init__(self):
        self.created = []
        self.status = "succeeded"

    async def create_payment(self, amount_rub, description, return_url, metadata, customer):
        self.created.append({"amount": amount_rub, "customer": customer, "meta": metadata})
        return Payment(id="pay-123", status="pending",
                       confirmation_url="https://yookassa.test/pay/123", metadata=metadata)

    async def get_payment(self, payment_id):
        return Payment(id=payment_id, status=self.status, confirmation_url=None, metadata={})


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("PROVIDER", "fake")
    monkeypatch.setenv("DB_URL", f"sqlite+aiosqlite:///{tmp_path}/pay.db")
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    from fastapi.testclient import TestClient

    from web.app import app

    with TestClient(app) as c:
        c.stub = StubPayments()
        app.state.payments = c.stub
        yield c


def _create_order(client, package="standard", contact="buyer@mail.ru") -> str:
    return client.post(
        "/api/orders",
        data={"package": package, "contact": contact, "consent": "yes"},
    ).json()["token"]


def test_order_creates_payment_and_webhook_starts_collecting(client):
    resp = client.post(
        "/api/orders",
        data={"package": "standard", "contact": "buyer@mail.ru", "consent": "yes"},
    )
    assert resp.status_code == 200
    data = resp.json()
    token = data["token"]
    assert data["payment_url"] == "https://yookassa.test/pay/123"
    assert client.stub.created[0]["amount"] == 990
    assert client.stub.created[0]["customer"] == {"email": "buyer@mail.ru"}
    assert client.get(f"/api/orders/{token}").json()["state"] == "awaiting_payment"

    # Вебхук: платёж успешен → заказ уходит к сбору фото.
    resp = client.post("/api/payments/yookassa", json={"object": {"id": "pay-123"}})
    assert resp.status_code == 200
    assert client.get(f"/api/orders/{token}").json()["state"] == "collecting"

    # Повторный вебхук идемпотентен (заказ уже не в awaiting_payment).
    resp = client.post("/api/payments/yookassa", json={"object": {"id": "pay-123"}})
    assert resp.status_code == 200


def test_webhook_ignores_unsucceeded_and_unknown(client):
    token = _create_order(client)
    client.stub.status = "canceled"
    client.post("/api/payments/yookassa", json={"object": {"id": "pay-123"}})
    assert client.get(f"/api/orders/{token}").json()["state"] == "awaiting_payment"

    assert client.post("/api/payments/yookassa", json={"bad": 1}).status_code == 400


def test_customer_from_contact():
    assert customer_from_contact("a@b.ru") == {"email": "a@b.ru"}
    assert customer_from_contact("+7 (926) 503-13-68") == {"phone": "79265031368"}
    assert customer_from_contact("89265031368") == {"phone": "79265031368"}
    assert customer_from_contact("9265031368") == {"phone": "79265031368"}
    assert customer_from_contact("@telegram_nick") is None

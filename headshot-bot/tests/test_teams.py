"""B2B: расчёт цены по числу сотрудников и заявка (счёт / карта-СБП)."""
import pytest

from core.teams import team_quote


def test_quote_ladder():
    assert team_quote(1)["per_seat"] == 1490
    assert team_quote(5)["per_seat"] == 1290
    assert team_quote(10)["per_seat"] == 1090
    assert team_quote(25)["per_seat"] == 990
    assert team_quote(50)["per_seat"] == 890
    assert team_quote(100)["per_seat"] == 790
    q = team_quote(10)
    assert q["total"] == 10 * 1090
    assert q["discount"] == 10 * 1490 - 10 * 1090
    assert q["percent"] == round((1 - 1090 / 1490) * 100)


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("PROVIDER", "fake")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("DB_URL", f"sqlite+aiosqlite:///{tmp_path}/team.db")
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    from fastapi.testclient import TestClient

    from web.app import app
    with TestClient(app) as c:
        yield c


def test_quote_api(client):
    r = client.get("/api/team/quote", params={"n": 25})
    assert r.status_code == 200
    assert r.json()["per_seat"] == 990
    assert r.json()["headcount"] == 25


def test_checkout_requires_auth(client):
    assert client.post(
        "/api/team/checkout", data={"mode": "card", "headcount": 10}
    ).status_code == 401


def test_checkout_invoice_and_card(client, monkeypatch):
    sent = []

    async def fake_send(settings, to, subject, text, html=None):
        sent.append({"to": to, "subject": subject, "text": text})

    monkeypatch.setattr("web.app.send_email", fake_send)
    client.post("/api/auth/register", data={"email": "boss@co.ru", "password": "longenough1"})

    # Счёт без реквизитов — отказ.
    assert client.post(
        "/api/team/checkout", data={"mode": "invoice", "headcount": 10}
    ).status_code == 422

    r = client.post("/api/team/checkout", data={
        "mode": "invoice", "headcount": 10, "company": "ООО Ромашка", "inn": "7701234567",
    })
    assert r.status_code == 200 and r.json()["mode"] == "invoice"
    assert any("запрос счёта" in m["subject"] for m in sent)
    assert any(m["to"] == "hello@d-portret.ru" for m in sent)

    # Карта/СБП — заявка уходит с пометкой.
    r = client.post("/api/team/checkout", data={"mode": "card", "headcount": 50})
    assert r.status_code == 200 and r.json()["mode"] == "card"
    assert any("Оплатить картой" in m["subject"] for m in sent)

    # Обе заявки видны в кабинете.
    tr = client.get("/api/account/orders").json()["team_requests"]
    assert len(tr) == 2
    assert {x["mode"] for x in tr} == {"invoice", "card"}
    assert any(x["total_rub"] == team_quote(50)["total"] for x in tr)

    # Неизвестный режим — 422.
    assert client.post(
        "/api/team/checkout", data={"mode": "wat", "headcount": 10}
    ).status_code == 422

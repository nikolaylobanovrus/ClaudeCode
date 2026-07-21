"""Веб-аккаунты: регистрация, вход, сессия, сброс/подтверждение, кабинет."""
import re

import pytest


@pytest.fixture
def sent(monkeypatch):
    box = []

    async def fake_send(settings, to, subject, text, html=None):
        box.append({"to": to, "subject": subject, "text": text})

    monkeypatch.setattr("web.auth.send_email", fake_send)
    return box


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("PROVIDER", "fake")
    monkeypatch.setenv("PAYMENT_STUB", "true")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("DB_URL", f"sqlite+aiosqlite:///{tmp_path}/auth.db")
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    from fastapi.testclient import TestClient

    from web.app import app
    with TestClient(app) as c:
        yield c


def _token(text: str) -> str:
    return re.search(r"token=([\w\-]+)", text).group(1)


def test_register_login_logout(client, sent):
    r = client.post("/api/auth/register", data={"email": "U@X.ru", "password": "longenough1"})
    assert r.status_code == 200
    assert r.json()["account"] == {"email": "u@x.ru", "verified": False}
    # Письмо-подтверждение ушло.
    assert any(m["subject"].startswith("Подтвердите") for m in sent)
    assert client.get("/api/auth/me").json()["account"]["email"] == "u@x.ru"

    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").json()["account"] is None

    assert client.post("/api/auth/login",
                       data={"email": "u@x.ru", "password": "wrong"}).status_code == 401
    r = client.post("/api/auth/login", data={"email": "u@x.ru", "password": "longenough1"})
    assert r.status_code == 200
    assert client.get("/api/auth/me").json()["account"]["email"] == "u@x.ru"


def test_register_validation(client, sent):
    assert client.post("/api/auth/register",
                       data={"email": "notanemail", "password": "longenough1"}).status_code == 422
    assert client.post("/api/auth/register",
                       data={"email": "a@b.ru", "password": "short"}).status_code == 422
    client.post("/api/auth/register", data={"email": "a@b.ru", "password": "longenough1"})
    # Повторная регистрация того же email.
    assert client.post("/api/auth/register",
                       data={"email": "a@b.ru", "password": "longenough1"}).status_code == 409


def test_forgot_reset_flow(client, sent):
    client.post("/api/auth/register", data={"email": "u@x.ru", "password": "oldpassword1"})
    old_sid = client.cookies.get("sid")
    sent.clear()

    # Несуществующий email — тоже 200 (без перечисления), письма нет.
    assert client.post("/api/auth/forgot", data={"email": "ghost@x.ru"}).status_code == 200
    assert sent == []

    assert client.post("/api/auth/forgot", data={"email": "u@x.ru"}).status_code == 200
    reset_mail = next(m for m in sent if m["subject"].startswith("Сброс"))
    token = _token(reset_mail["text"])

    # Сброс на новый пароль.
    r = client.post("/api/auth/reset", data={"token": token, "password": "brandnew12"})
    assert r.status_code == 200

    # Старая сессия аннулирована.
    assert client.get("/api/auth/me", cookies={"sid": old_sid}).json()["account"] is None
    # Старый пароль больше не подходит, новый — работает.
    assert client.post("/api/auth/login",
                       data={"email": "u@x.ru", "password": "oldpassword1"}).status_code == 401
    assert client.post("/api/auth/login",
                       data={"email": "u@x.ru", "password": "brandnew12"}).status_code == 200

    # Повторное использование токена сброса запрещено.
    assert client.post("/api/auth/reset",
                       data={"token": token, "password": "another123"}).status_code == 400


def test_verify_email(client, sent):
    client.post("/api/auth/register", data={"email": "u@x.ru", "password": "longenough1"})
    verify_mail = next(m for m in sent if m["subject"].startswith("Подтвердите"))
    token = _token(verify_mail["text"])
    assert client.post("/api/auth/verify", data={"token": token}).status_code == 200
    assert client.get("/api/auth/me").json()["account"]["verified"] is True


def test_change_password(client, sent):
    client.post("/api/auth/register", data={"email": "u@x.ru", "password": "firstpass12"})
    assert client.post("/api/auth/change-password",
                       data={"old_password": "wrong", "new_password": "secondpass12"}
                       ).status_code == 401
    assert client.post("/api/auth/change-password",
                       data={"old_password": "firstpass12", "new_password": "secondpass12"}
                       ).status_code == 200
    client.post("/api/auth/logout")
    assert client.post("/api/auth/login",
                       data={"email": "u@x.ru", "password": "secondpass12"}).status_code == 200


def _make_order(client, contact):
    return client.post(
        "/api/orders",
        data={"package": "standard", "contact": contact, "consent": "yes"},
    ).json()["token"]


def test_account_orders_and_guest_claim(client, sent):
    # Гостевой заказ создан ДО регистрации (без сессии), с тем же email.
    token = _make_order(client, "owner@x.ru")
    client.post("/api/auth/register", data={"email": "owner@x.ru", "password": "longenough1"})

    # До подтверждения email гостевой заказ НЕ подхватывается (защита от присвоения).
    assert client.get("/api/account/orders").json()["orders"] == []

    # Подтверждаем email → гостевой заказ привязывается к аккаунту.
    vtoken = _token(next(m for m in sent if m["subject"].startswith("Подтвердите"))["text"])
    assert client.post("/api/auth/verify", data={"token": vtoken}).status_code == 200
    orders = client.get("/api/account/orders").json()["orders"]
    assert len(orders) == 1
    assert orders[0]["token"] == token
    assert orders[0]["package"] == "standard"

    # Новый заказ из-под аккаунта привязывается сразу.
    _make_order(client, "owner@x.ru")
    assert len(client.get("/api/account/orders").json()["orders"]) == 2


def test_change_password_invalidates_other_sessions(client, sent):
    client.post("/api/auth/register", data={"email": "u@x.ru", "password": "firstpass12"})
    sid_a = client.cookies.get("sid")
    client.post("/api/auth/login", data={"email": "u@x.ru", "password": "firstpass12"})
    sid_b = client.cookies.get("sid")
    assert sid_a and sid_b and sid_a != sid_b

    # Смена пароля из сессии B гасит прочие (A), текущую (B) оставляет.
    assert client.post("/api/auth/change-password",
                       data={"old_password": "firstpass12", "new_password": "secondpass12"}
                       ).status_code == 200
    assert client.get("/api/auth/me", cookies={"sid": sid_a}).json()["account"] is None
    assert client.get("/api/auth/me").json()["account"]["email"] == "u@x.ru"


def test_account_orders_requires_auth(client):
    assert client.get("/api/account/orders").status_code == 401

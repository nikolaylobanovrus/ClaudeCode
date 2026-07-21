"""Пароли и токены доступа для веб-аккаунтов.

Хеширование пароля — PBKDF2-HMAC-SHA256 (stdlib, без внешних зависимостей).
Формат хранения: ``pbkdf2$<iters>$<salt_hex>$<hash_hex>``. Сессионные и
одноразовые токены (сброс пароля, подтверждение email) хранятся в БД только
в виде SHA-256 — исходный токен уходит клиенту и в базе не лежит.
"""
import hashlib
import hmac
import secrets

_ITERS = 200_000
_ALGO = "sha256"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac(_ALGO, password.encode("utf-8"), salt, _ITERS)
    return f"pbkdf2${_ITERS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters_s, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2":
            return False
        dk = hashlib.pbkdf2_hmac(
            _ALGO, password.encode("utf-8"), bytes.fromhex(salt_hex), int(iters_s)
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(dk.hex(), hash_hex)


def new_token() -> str:
    """Секретный токен, отдаётся клиенту (в cookie или ссылке)."""
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    """SHA-256 токена — только это хранится в БД."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

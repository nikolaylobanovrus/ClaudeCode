"""Веб-аккаунты: регистрация, вход, сессии, сброс пароля, кабинет.

Сессия — httpOnly-cookie ``sid`` (в БД только хеш токена). Токен сброса
пароля уходит письмом и хранится как хеш. Никакого перечисления
пользователей: /forgot всегда отвечает 200. Подтверждения email нет.
"""
import re
from datetime import timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Form, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import select

from core.email import send_email
from core.models import Account, AuthToken, Job, WebSession, utcnow
from core.security import (
    hash_password,
    new_token,
    token_hash,
    verify_password,
)

router = APIRouter()

SID = "sid"
SESSION_DAYS = 30
RESET_TTL = timedelta(hours=1)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# Фиктивный хеш: сверяем с ним пароль при отсутствии аккаунта, чтобы время
# ответа не выдавало, зарегистрирован ли email (защита от перечисления).
_DUMMY_HASH = hash_password("timing-equalizer-not-a-real-password")


def _norm_email(email: str) -> str:
    return email.strip().lower()


def _aware(dt):
    """SQLite отдаёт время без таймзоны — считаем его UTC для сравнения."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _valid_password(pw: str) -> bool:
    return 8 <= len(pw) <= 128


def _set_session_cookie(request: Request, resp: Response, token: str) -> None:
    resp.set_cookie(
        SID, token,
        max_age=SESSION_DAYS * 86400,
        httponly=True,
        secure=request.app.state.settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


async def _create_session(session, account_id: int) -> str:
    token = new_token()
    session.add(WebSession(
        account_id=account_id,
        token_hash=token_hash(token),
        expires_at=utcnow() + timedelta(days=SESSION_DAYS),
    ))
    return token


async def current_account(request: Request) -> Account | None:
    """Аккаунт по cookie сессии, либо None. Просроченные сессии игнорируются."""
    token = request.cookies.get(SID)
    if not token:
        return None
    async with request.app.state.session_factory() as session:
        ws = (await session.execute(
            select(WebSession).where(WebSession.token_hash == token_hash(token))
        )).scalar_one_or_none()
        if ws is None or _aware(ws.expires_at) <= utcnow():
            return None
        return await session.get(Account, ws.account_id)


@router.post("/api/auth/register")
async def register(request: Request, email: str = Form(...), password: str = Form(...)):
    email = _norm_email(email)
    if not EMAIL_RE.match(email) or len(email) > 200:
        return JSONResponse({"error": "bad_email"}, status_code=422)
    if not _valid_password(password):
        return JSONResponse({"error": "weak_password"}, status_code=422)
    async with request.app.state.session_factory() as session:
        exists = (await session.execute(
            select(Account).where(Account.email == email)
        )).scalar_one_or_none()
        if exists is not None:
            return JSONResponse({"error": "email_taken"}, status_code=409)
        account = Account(email=email, password_hash=hash_password(password))
        session.add(account)
        await session.flush()
        token = await _create_session(session, account.id)
        await session.commit()
        acc = {"email": account.email}
    resp = JSONResponse({"account": acc})
    _set_session_cookie(request, resp, token)
    return resp


@router.post("/api/auth/login")
async def login(request: Request, email: str = Form(...), password: str = Form(...)):
    email = _norm_email(email)
    async with request.app.state.session_factory() as session:
        account = (await session.execute(
            select(Account).where(Account.email == email)
        )).scalar_one_or_none()
        # Пароль сверяем всегда (в т.ч. с фиктивным хешем при отсутствии
        # аккаунта) — одинаковое время ответа против перечисления email.
        ok = verify_password(password, account.password_hash if account else _DUMMY_HASH)
        if account is None or not ok:
            return JSONResponse({"error": "bad_credentials"}, status_code=401)
        token = await _create_session(session, account.id)
        await session.commit()
        acc = {"email": account.email}
    resp = JSONResponse({"account": acc})
    _set_session_cookie(request, resp, token)
    return resp


@router.post("/api/auth/logout")
async def logout(request: Request):
    token = request.cookies.get(SID)
    if token:
        async with request.app.state.session_factory() as session:
            ws = (await session.execute(
                select(WebSession).where(WebSession.token_hash == token_hash(token))
            )).scalar_one_or_none()
            if ws is not None:
                await session.delete(ws)
                await session.commit()
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(SID, path="/")
    return resp


@router.get("/api/auth/me")
async def me(request: Request):
    account = await current_account(request)
    if account is None:
        return JSONResponse({"account": None})
    return {"account": {"email": account.email}}


async def _do_forgot(app, email: str) -> None:
    """Создание токена сброса и письмо — в фоне (после ответа), чтобы время
    ответа /forgot не выдавало существование аккаунта."""
    settings = app.state.settings
    async with app.state.session_factory() as session:
        account = (await session.execute(
            select(Account).where(Account.email == email)
        )).scalar_one_or_none()
        if account is None:
            return
        token = new_token()
        to_email = account.email
        session.add(AuthToken(
            account_id=account.id, kind=AuthToken.RESET,
            token_hash=token_hash(token), expires_at=utcnow() + RESET_TTL,
        ))
        await session.commit()
    link = f"{settings.public_base_url}/app/reset?token={token}"
    await send_email(
        settings, to_email, "Сброс пароля — Деловые портреты",
        f"Чтобы задать новый пароль, перейдите по ссылке:\n{link}\n\n"
        f"Ссылка действует 1 час. Если вы не запрашивали сброс — просто "
        f"проигнорируйте это письмо.",
        f'<p>Задайте новый пароль:</p><p><a href="{link}">Сбросить пароль</a></p>'
        f"<p style='color:#888;font-size:13px'>Ссылка действует 1 час. "
        f"Если вы не запрашивали сброс — проигнорируйте письмо.</p>",
    )


@router.post("/api/auth/forgot")
async def forgot(request: Request, background: BackgroundTasks, email: str = Form(...)):
    background.add_task(_do_forgot, request.app, _norm_email(email))
    # Всегда одинаковый быстрый ответ — не раскрываем, есть ли аккаунт.
    return {"ok": True}


async def _consume_token(session, kind: str, token: str) -> AuthToken | None:
    at = (await session.execute(
        select(AuthToken).where(
            AuthToken.token_hash == token_hash(token), AuthToken.kind == kind
        )
    )).scalar_one_or_none()
    if at is None or at.used_at is not None or _aware(at.expires_at) <= utcnow():
        return None
    return at


@router.post("/api/auth/reset")
async def reset(request: Request, token: str = Form(...), password: str = Form(...)):
    if not _valid_password(password):
        return JSONResponse({"error": "weak_password"}, status_code=422)
    async with request.app.state.session_factory() as session:
        at = await _consume_token(session, AuthToken.RESET, token)
        if at is None:
            return JSONResponse({"error": "bad_token"}, status_code=400)
        account = await session.get(Account, at.account_id)
        account.password_hash = hash_password(password)
        at.used_at = utcnow()
        # Сброс пароля завершает все прежние сессии аккаунта.
        for ws in (await session.execute(
            select(WebSession).where(WebSession.account_id == account.id)
        )).scalars().all():
            await session.delete(ws)
        new_sid = await _create_session(session, account.id)
        await session.commit()
        acc = {"email": account.email}
    resp = JSONResponse({"account": acc})
    _set_session_cookie(request, resp, new_sid)
    return resp


@router.post("/api/auth/change-password")
async def change_password(
    request: Request, old_password: str = Form(...), new_password: str = Form(...)
):
    account = await current_account(request)
    if account is None:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    if not _valid_password(new_password):
        return JSONResponse({"error": "weak_password"}, status_code=422)
    current = request.cookies.get(SID)
    current_hash = token_hash(current) if current else None
    async with request.app.state.session_factory() as session:
        acc = await session.get(Account, account.id)
        if not verify_password(old_password, acc.password_hash):
            return JSONResponse({"error": "bad_credentials"}, status_code=401)
        acc.password_hash = hash_password(new_password)
        # Гасим прочие сессии (возможная компрометация), текущую оставляем.
        for ws in (await session.execute(
            select(WebSession).where(WebSession.account_id == acc.id)
        )).scalars().all():
            if ws.token_hash != current_hash:
                await session.delete(ws)
        await session.commit()
    return {"ok": True}


def _package_title(code: str | None) -> str | None:
    from core.packages import PACKAGES
    pkg = PACKAGES.get(code or "")
    return pkg.title if pkg else code


@router.get("/api/account/orders")
async def account_orders(request: Request):
    from sqlalchemy import func

    from core.models import Photo

    account = await current_account(request)
    if account is None:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    async with request.app.state.session_factory() as session:
        jobs = (await session.execute(
            select(Job).where(Job.account_id == account.id).order_by(Job.id.desc())
        )).scalars().all()
        out = []
        for job in jobs:
            results = (await session.execute(
                select(Photo).where(Photo.job_id == job.id, Photo.kind == Photo.RESULT)
            )).scalars().all()
            photos = (await session.execute(
                select(func.count()).select_from(Photo).where(
                    Photo.job_id == job.id, Photo.kind == Photo.SOURCE
                )
            )).scalar() or 0
            out.append({
                "token": job.access_token,
                "state": job.state,
                "package": job.package_code,
                "package_title": _package_title(job.package_code),
                "photos": photos,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "results": [
                    {"id": p.id, "url": f"/api/orders/{job.access_token}/result/{p.id}"}
                    for p in results[:4]
                ],
                "results_count": len(results),
            })
    return {"orders": out}

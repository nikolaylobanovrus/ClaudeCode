"""HTTPS-хук управления бэкендом.

Защищённые токеном эндпоинты /api/admin/*, через которые можно удалённо:
деплоить (git pull → rsync → restart), смотреть статус сервисов и версию,
читать хвост журналов, перезапускать сервисы. Токен задаётся в env
ADMIN_API_TOKEN; при пустом токене все эндпоинты отдают 404 (хук выключен).

Безопасность: сравнение токена постоянного времени; никаких произвольных
команд — только фиксированный набор через exec-форму (без shell); имена
сервисов проверяются по белому списку; все действия логируются.
"""
import asyncio
import os
import secrets
from pathlib import Path

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/admin")

# Разрешённые сервисы (защита от инъекции в имя юнита).
SERVICES = {"web": "headshot-web", "bot": "headshot-bot", "nginx": "nginx"}
LOG_SERVICES = {"web": "headshot-web", "bot": "headshot-bot"}
DEPLOY_UNIT = "headshot-deploy"


def _token_ok(request: Request, provided: str | None) -> bool:
    expected = request.app.state.settings.admin_api_token
    if not expected or not provided:
        return False
    return secrets.compare_digest(provided, expected)


def _guard(request: Request, token: str | None):
    """Возвращает JSONResponse при отказе, либо None если доступ разрешён.

    Хук выключен (нет токена в env) → 404, чтобы не выдавать существование
    эндпоинта. Неверный токен → 401.
    """
    if not request.app.state.settings.admin_api_token:
        return JSONResponse({"error": "not_found"}, status_code=404)
    if not _token_ok(request, token):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return None


async def _run(cmd: list[str], timeout: float = 30.0) -> tuple[int, str]:
    """Запускает команду (exec-форма, без shell) и возвращает (код, вывод)."""
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        return 124, f"timeout after {timeout}s"
    return proc.returncode or 0, (out or b"").decode("utf-8", "replace")


@router.get("/status")
async def status(request: Request, x_admin_token: str | None = Header(default=None)):
    denied = _guard(request, x_admin_token)
    if denied:
        return denied
    src = request.app.state.settings.deploy_src_dir
    _, sha = await _run(["git", "-C", src, "rev-parse", "--short", "HEAD"], timeout=10)
    _, subject = await _run(
        ["git", "-C", src, "log", "-1", "--pretty=%s"], timeout=10
    )
    _, active = await _run(
        ["systemctl", "is-active", "headshot-web", "headshot-bot", "nginx"], timeout=10
    )
    _, disk = await _run(["df", "-h", "/"], timeout=10)
    states = active.split()
    return {
        "commit": sha.strip(),
        "commit_subject": subject.strip(),
        "services": {
            "headshot-web": states[0] if len(states) > 0 else "unknown",
            "headshot-bot": states[1] if len(states) > 1 else "unknown",
            "nginx": states[2] if len(states) > 2 else "unknown",
        },
        "disk": disk.strip().splitlines()[-1] if disk.strip() else "",
    }


@router.post("/deploy")
async def deploy(request: Request, x_admin_token: str | None = Header(default=None)):
    """Запускает деплой в отдельном systemd-юните, чтобы рестарт веб-сервиса
    (частью деплоя) не убил сам процесс деплоя. Возвращает управление сразу."""
    denied = _guard(request, x_admin_token)
    if denied:
        return denied
    src = request.app.state.settings.deploy_src_dir
    _, before = await _run(["git", "-C", src, "rev-parse", "--short", "HEAD"], timeout=10)
    script = "/opt/headshot-bot/deploy/self_deploy.sh"
    code, out = await _run(
        [
            "systemd-run", "--collect", f"--unit={DEPLOY_UNIT}",
            "--description=Деловой Портрет self-deploy",
            "bash", script,
        ],
        timeout=15,
    )
    if code != 0:
        # Юнит уже существует → деплой уже идёт.
        busy = "already exists" in out or "Unit " in out
        return JSONResponse(
            {"error": "deploy_busy" if busy else "deploy_failed", "detail": out.strip()},
            status_code=409 if busy else 500,
        )
    return {"ok": True, "before": before.strip(), "log": "/root/deploy.log"}


@router.post("/restart")
async def restart(request: Request, x_admin_token: str | None = Header(default=None)):
    denied = _guard(request, x_admin_token)
    if denied:
        return denied
    # Рестарт в отдельном юните — иначе рестарт headshot-web оборвёт ответ.
    code, out = await _run(
        [
            "systemd-run", "--collect", "--unit=headshot-restart",
            "systemctl", "restart", "headshot-web", "headshot-bot",
        ],
        timeout=15,
    )
    if code != 0:
        return JSONResponse({"error": "restart_failed", "detail": out.strip()}, status_code=500)
    return {"ok": True}


@router.get("/logs")
async def logs(
    request: Request,
    service: str = "web",
    lines: int = 100,
    x_admin_token: str | None = Header(default=None),
):
    denied = _guard(request, x_admin_token)
    if denied:
        return denied
    unit = LOG_SERVICES.get(service)
    if unit is None:
        return JSONResponse({"error": "bad_service"}, status_code=422)
    lines = max(1, min(lines, 2000))
    _, out = await _run(
        ["journalctl", "-u", unit, "-n", str(lines), "--no-pager"], timeout=20
    )
    return {"service": unit, "lines": lines, "log": out}


@router.get("/deploy-log")
async def deploy_log(
    request: Request, lines: int = 200, x_admin_token: str | None = Header(default=None)
):
    """Хвост журнала последнего self-deploy (/root/deploy.log)."""
    denied = _guard(request, x_admin_token)
    if denied:
        return denied
    lines = max(1, min(lines, 2000))
    _, out = await _run(["tail", "-n", str(lines), "/root/deploy.log"], timeout=10)
    return {"log": out}


# Файл секретов сервера (деплой копирует его в рабочий .env сервисов).
ENV_FILE = os.environ.get("HEADSHOT_ENV_FILE", "/root/headshot.env")
# Белый список ключей, изменяемых через хук: только настройки почты.
ENV_ALLOWED = {"SMTP_HOST", "SMTP_PORT", "SMTP_SSL", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"}


@router.post("/env")
async def set_env(request: Request, x_admin_token: str | None = Header(default=None)):
    """Обновить SMTP-настройки в файле секретов сервера.

    Принимает JSON {КЛЮЧ: значение}; ключи — строго из белого списка ENV_ALLOWED.
    Существующие строки с этими ключами заменяются, новые дописываются.
    Значения в ответ и в логи не попадают. Применение — обычным деплоем
    (deploy.sh копирует файл в .env и перезапускает сервисы).
    """
    denied = _guard(request, x_admin_token)
    if denied:
        return denied
    try:
        payload = await request.json()
        assert isinstance(payload, dict)
    except Exception:
        return JSONResponse({"error": "bad_payload"}, status_code=400)
    bad = [k for k in payload if k not in ENV_ALLOWED]
    if bad:
        return JSONResponse({"error": "key_not_allowed", "keys": bad}, status_code=422)
    clean: dict[str, str] = {}
    for k, v in payload.items():
        v = str(v)
        # Однострочные значения без управляющих символов — иначе сломаем env-файл.
        if len(v) > 300 or any(ch in v for ch in "\r\n\0"):
            return JSONResponse({"error": "bad_value", "key": k}, status_code=422)
        clean[k] = v
    path = Path(ENV_FILE)
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    keys_left = dict(clean)
    out = []
    for line in lines:
        name = line.split("=", 1)[0].strip()
        if name in keys_left:
            out.append(f"{name}={keys_left.pop(name)}")
        else:
            out.append(line)
    out.extend(f"{k}={v}" for k, v in keys_left.items())
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    os.chmod(path, 0o600)
    return {"ok": True, "updated": sorted(clean)}


@router.get("/jobs")
async def jobs(
    request: Request,
    state: str | None = None,
    limit: int = 20,
    x_admin_token: str | None = Header(default=None),
):
    """Список последних заказов для диагностики (в т.ч. упавших на генерации).

    Показывает состояние, число попыток, ошибку и сколько кадров уже готово —
    видно, докуда дошла генерация и стоит ли перезапускать.
    """
    denied = _guard(request, x_admin_token)
    if denied:
        return denied
    from sqlalchemy import desc, func, select

    from core.models import Job, Photo

    limit = max(1, min(limit, 100))
    async with request.app.state.session_factory() as session:
        stmt = select(Job).order_by(desc(Job.updated_at)).limit(limit)
        if state:
            stmt = stmt.where(Job.state == state)
        rows = (await session.execute(stmt)).scalars().all()
        out = []
        for j in rows:
            done = (await session.execute(
                select(func.count()).select_from(Photo).where(
                    Photo.job_id == j.id, Photo.kind == Photo.RESULT)
            )).scalar() or 0
            out.append({
                "id": j.id, "state": j.state, "package": j.package_code,
                "attempts": j.attempts, "retry_to": j.retry_to,
                "error": (j.error or "")[:300], "channel": j.channel,
                "contact": j.contact, "results": done,
                "has_model": bool(j.model_ref),
                "updated_at": j.updated_at.isoformat() if j.updated_at else None,
            })
        return {"jobs": out}


@router.post("/jobs/{job_id}/retry")
async def retry_job(
    request: Request, job_id: int, x_admin_token: str | None = Header(default=None)
):
    """Возвращает упавший заказ в конвейер: сбрасывает попытки и выставляет
    состояние, с которого воркер продолжит. Генерация идемпотентна по стилям —
    уже готовые кадры не пересоздаются, доплата fal только за недостающие."""
    denied = _guard(request, x_admin_token)
    if denied:
        return denied
    from core.models import Job
    from core.states import JobState

    async with request.app.state.session_factory() as session:
        job = await session.get(Job, job_id)
        if job is None:
            return JSONResponse({"error": "not_found"}, status_code=404)
        if JobState(job.state) is not JobState.FAILED:
            return JSONResponse(
                {"error": "not_failed", "state": job.state}, status_code=409)
        # Куда вернуть: на зафиксированный retry_to; иначе — по наличию модели.
        target = job.retry_to or (
            JobState.GENERATING.value if job.model_ref else JobState.TRAINING.value)
        job.state = target
        job.attempts = 0
        job.error = None
        await session.commit()
        return {"ok": True, "id": job_id, "state": job.state, "results": None}

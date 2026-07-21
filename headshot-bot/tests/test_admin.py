"""HTTPS-хук управления бэкендом: авторизация и форма ответов.

Реальные системные команды (git/systemctl/journalctl) замоканы — проверяем
защиту токеном и контракт эндпоинтов, а не выполнение на сервере.
"""
import pytest

TOKEN = "s3cr3t-admin-token-value"


def make_client(monkeypatch, tmp_path, token=TOKEN):
    monkeypatch.setenv("PROVIDER", "fake")
    monkeypatch.setenv("DB_URL", f"sqlite+aiosqlite:///{tmp_path}/admin.db")
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    if token is None:
        monkeypatch.delenv("ADMIN_API_TOKEN", raising=False)
    else:
        monkeypatch.setenv("ADMIN_API_TOKEN", token)
    from fastapi.testclient import TestClient

    from web.app import app
    return TestClient(app)


async def _fake_run(cmd, timeout=30.0):
    """Подделка запуска команд: отвечает по первому аргументу."""
    if cmd[0] == "git" and "rev-parse" in cmd:
        return 0, "abc1234\n"
    if cmd[0] == "git":
        return 0, "Тестовый коммит\n"
    if cmd[0] == "systemctl":
        return 0, "active\nactive\nactive\n"
    if cmd[0] == "df":
        return 0, "Filesystem Size Used Avail Use%\n/dev/x 15G 5G 10G 33% /\n"
    if cmd[0] == "systemd-run":
        return 0, ""
    if cmd[0] == "journalctl":
        return 0, "log line 1\nlog line 2\n"
    if cmd[0] == "tail":
        return 0, "deploy log tail\n"
    return 0, ""


def test_hook_disabled_returns_404(monkeypatch, tmp_path):
    with make_client(monkeypatch, tmp_path, token=None) as client:
        assert client.get("/api/admin/status").status_code == 404


def test_wrong_token_unauthorized(monkeypatch, tmp_path):
    import web.admin as admin
    monkeypatch.setattr(admin, "_run", _fake_run)
    with make_client(monkeypatch, tmp_path) as client:
        r = client.get("/api/admin/status", headers={"X-Admin-Token": "nope"})
        assert r.status_code == 401
        r = client.get("/api/admin/status")  # без заголовка
        assert r.status_code == 401


def test_status_ok_with_token(monkeypatch, tmp_path):
    import web.admin as admin
    monkeypatch.setattr(admin, "_run", _fake_run)
    with make_client(monkeypatch, tmp_path) as client:
        r = client.get("/api/admin/status", headers={"X-Admin-Token": TOKEN})
        assert r.status_code == 200
        data = r.json()
        assert data["commit"] == "abc1234"
        assert data["services"]["headshot-web"] == "active"
        assert data["services"]["nginx"] == "active"


def test_deploy_triggers_unit(monkeypatch, tmp_path):
    import web.admin as admin
    seen = {}

    async def spy_run(cmd, timeout=30.0):
        seen.setdefault("cmds", []).append(cmd)
        return await _fake_run(cmd, timeout)

    monkeypatch.setattr(admin, "_run", spy_run)
    with make_client(monkeypatch, tmp_path) as client:
        r = client.post("/api/admin/deploy", headers={"X-Admin-Token": TOKEN})
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # Деплой запущен через systemd-run отдельным юнитом.
        assert any(c[0] == "systemd-run" for c in seen["cmds"])


def test_deploy_busy_returns_409(monkeypatch, tmp_path):
    import web.admin as admin

    async def busy_run(cmd, timeout=30.0):
        if cmd[0] == "systemd-run":
            return 1, "Unit headshot-deploy.service already exists."
        return await _fake_run(cmd, timeout)

    monkeypatch.setattr(admin, "_run", busy_run)
    with make_client(monkeypatch, tmp_path) as client:
        r = client.post("/api/admin/deploy", headers={"X-Admin-Token": TOKEN})
        assert r.status_code == 409
        assert r.json()["error"] == "deploy_busy"


def test_logs_bad_service(monkeypatch, tmp_path):
    import web.admin as admin
    monkeypatch.setattr(admin, "_run", _fake_run)
    with make_client(monkeypatch, tmp_path) as client:
        r = client.get("/api/admin/logs", params={"service": "root"},
                       headers={"X-Admin-Token": TOKEN})
        assert r.status_code == 422
        r = client.get("/api/admin/logs", params={"service": "web", "lines": 50},
                       headers={"X-Admin-Token": TOKEN})
        assert r.status_code == 200
        assert r.json()["service"] == "headshot-web"


@pytest.mark.parametrize("path", ["/api/admin/status", "/api/admin/deploy-log"])
def test_endpoints_require_token(monkeypatch, tmp_path, path):
    import web.admin as admin
    monkeypatch.setattr(admin, "_run", _fake_run)
    with make_client(monkeypatch, tmp_path) as client:
        assert client.get(path).status_code == 401

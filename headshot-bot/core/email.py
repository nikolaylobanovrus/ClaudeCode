"""Отправка транзакционных писем клиентам.

Бэкенды выбираются автоматически: при заданном SMTP_HOST письмо уходит по
SMTP (в отдельном потоке — smtplib блокирующий); иначе складывается в
data/outbox/*.eml и логируется. Запасной бэкенд позволяет тестировать флоу
(подтверждение email, сброс пароля) без реального почтового сервера и не
роняет заказ, если почта временно недоступна.
"""
import asyncio
import logging
import smtplib
from email.message import EmailMessage
from pathlib import Path

log = logging.getLogger("email")


def _build(settings, to: str, subject: str, text: str, html: str | None) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    return msg


def _send_smtp(settings, msg: EmailMessage) -> None:
    if settings.smtp_ssl:
        server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20)
    else:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20)
        server.starttls()
    try:
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
    finally:
        server.quit()


def _send_outbox(settings, msg: EmailMessage) -> None:
    outbox = Path(settings.data_dir) / "outbox"
    outbox.mkdir(parents=True, exist_ok=True)
    # Имя без времени (Date.now недоступен в некоторых окружениях) — по счётчику.
    n = len(list(outbox.glob("*.eml")))
    (outbox / f"{n:04d}.eml").write_bytes(bytes(msg))
    log.warning("SMTP не настроен — письмо для %s сложено в outbox: %s",
                msg["To"], msg["Subject"])


async def send_email(settings, to: str, subject: str, text: str, html: str | None = None) -> None:
    msg = _build(settings, to, subject, text, html)
    loop = asyncio.get_running_loop()
    if settings.smtp_host:
        try:
            await loop.run_in_executor(None, _send_smtp, settings, msg)
            return
        except Exception:
            log.exception("SMTP-отправка не удалась, складываю в outbox")
    await loop.run_in_executor(None, _send_outbox, settings, msg)

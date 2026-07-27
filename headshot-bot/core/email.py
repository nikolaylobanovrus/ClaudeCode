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


def valid_client_email(to: str | None) -> bool:
    """Настоящий клиентский email: не телефон и не синтетика автотестов."""
    to = (to or "").strip()
    return "@" in to and not to.lower().endswith("@d-portret.ru")


async def send_payment_email(settings, to: str, token: str | None, started: bool) -> None:
    """Письмо клиенту сразу после оплаты web-заказа.

    started=True — селфи уже загружены, генерация запущена (обычный путь);
    False — легаси «оплата вперёд», клиенту ещё надо загрузить фото.
    Ошибки глушим — письмо не должно ломать подтверждение оплаты."""
    if not valid_client_email(to):
        return
    base = settings.public_base_url
    link = f"{base}/app/order?t={token}" if token else f"{base}/app/login"
    if started:
        subject = "Оплата получена — создаём ваши портреты ✨"
        body_line = ("Генерация запущена: нейросеть обучается на ваших селфи. "
                     "Обычно это занимает около часа — как только портреты будут готовы, "
                     "пришлём отдельное письмо.")
        cta = "Следить за заказом"
    else:
        subject = "Оплата получена — загрузите селфи"
        body_line = ("Осталось загрузить 10–15 селфи по ссылке ниже — "
                     "после этого запустим генерацию (около часа).")
        cta = "Загрузить селфи"
    text = (
        "Здравствуйте!\n\n"
        f"Оплата прошла успешно, заказ принят. {body_line}\n\n"
        f"Страница вашего заказа:\n{link}\n\n"
        "Ссылка личная — не пересылайте её. Фискальный чек придёт отдельным "
        "письмом от ЮKassa.\n\nСпасибо, что выбрали «Деловой Портрет»!"
    )
    html = (
        '<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1B1D22">'
        f'<h2 style="font-weight:600">{subject}</h2>'
        f'<p style="font:15px/1.6 system-ui,sans-serif">Оплата прошла успешно, заказ принят. {body_line}</p>'
        f'<p><a href="{link}" style="display:inline-block;background:#1B1D22;color:#fff;'
        'text-decoration:none;padding:13px 26px;border-radius:999px;'
        f'font:650 15px system-ui,sans-serif">{cta}</a></p>'
        '<p style="font:13px/1.6 system-ui,sans-serif;color:#6A6D74">Ссылка личная — не пересылайте её. '
        'Фискальный чек придёт отдельным письмом от ЮKassa.<br>'
        'Спасибо, что выбрали «Деловой Портрет»!</p></div>'
    )
    try:
        await send_email(settings, to, subject, text, html)
    except Exception:
        log.exception("Не удалось отправить письмо об оплате на %s", to)

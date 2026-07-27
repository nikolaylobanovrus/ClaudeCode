"""ЮKassa: создание платежа с фискальным чеком и проверка статуса.

Безопасность вебхука: уведомлению не доверяем — по payment_id всегда
перечитываем платёж прямым GET к API и действуем по его статусу.
Чеки: включён режим «Чеки от ЮKassa», поэтому в каждый платёж передаём
receipt с контактом покупателя (email или телефон) и позицией услуги.
"""
import logging
import re
import time
import uuid
from dataclasses import dataclass

import aiohttp

log = logging.getLogger("payments")

API = "https://api.yookassa.ru/v3"
VAT_NONE = 1  # без НДС
# Без явного таймаута aiohttp ждёт до 5 минут — клиент всё это время видит
# «Открываем оплату…». Медленный ответ ЮKassa лучше быстро превратить в ошибку.
_TIMEOUT = aiohttp.ClientTimeout(total=20)


@dataclass(frozen=True)
class Payment:
    id: str
    status: str  # pending | waiting_for_capture | succeeded | canceled
    confirmation_url: str | None
    metadata: dict


def customer_from_contact(contact: str) -> dict | None:
    """email/телефон для чека из свободного поля контакта. None — не распознан."""
    contact = contact.strip()
    if "@" in contact and "." in contact.split("@")[-1]:
        return {"email": contact}
    digits = re.sub(r"\D", "", contact)
    if len(digits) == 11 and digits[0] in "78":
        return {"phone": "7" + digits[1:]}
    if len(digits) == 10 and digits[0] == "9":
        return {"phone": "7" + digits}
    return None


class YooKassaClient:
    def __init__(self, shop_id: str, secret: str):
        if not (shop_id and secret):
            raise ValueError("Нужны YOOKASSA_SHOP_ID и YOOKASSA_SECRET")
        self._auth = aiohttp.BasicAuth(shop_id, secret)

    async def create_payment(
        self,
        amount_rub: int,
        description: str,
        return_url: str,
        metadata: dict,
        customer: dict | None,
    ) -> Payment:
        body = {
            "amount": {"value": f"{amount_rub}.00", "currency": "RUB"},
            "capture": True,
            "confirmation": {"type": "redirect", "return_url": return_url},
            "description": description,
            "metadata": metadata,
        }
        if customer:
            body["receipt"] = {
                "customer": customer,
                "items": [{
                    "description": description[:128],
                    "quantity": "1",
                    "amount": {"value": f"{amount_rub}.00", "currency": "RUB"},
                    "vat_code": VAT_NONE,
                    "payment_subject": "service",
                    "payment_mode": "full_payment",
                }],
            }
        headers = {"Idempotence-Key": str(uuid.uuid4())}
        t0 = time.monotonic()
        async with aiohttp.ClientSession(auth=self._auth, timeout=_TIMEOUT) as s:
            async with s.post(f"{API}/payments", json=body, headers=headers) as r:
                data = await r.json()
                log.info("ЮKassa create_payment: HTTP %s за %.0f мс",
                         r.status, (time.monotonic() - t0) * 1000)
                if r.status not in (200, 201):
                    raise RuntimeError(f"ЮKassa create: {r.status} {data}")
        return _parse(data)

    async def get_payment(self, payment_id: str) -> Payment:
        t0 = time.monotonic()
        async with aiohttp.ClientSession(auth=self._auth, timeout=_TIMEOUT) as s:
            async with s.get(f"{API}/payments/{payment_id}") as r:
                data = await r.json()
                log.info("ЮKassa get_payment: HTTP %s за %.0f мс",
                         r.status, (time.monotonic() - t0) * 1000)
                if r.status != 200:
                    raise RuntimeError(f"ЮKassa get: {r.status} {data}")
        return _parse(data)


def _parse(data: dict) -> Payment:
    conf = data.get("confirmation") or {}
    return Payment(
        id=data["id"],
        status=data.get("status", "pending"),
        confirmation_url=conf.get("confirmation_url"),
        metadata=data.get("metadata") or {},
    )

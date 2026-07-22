"""Расчёт командной (B2B) цены по числу сотрудников.

Один источник правды для лендинга (калькулятор), личного кабинета и письма
о заявке. Цена за сотрудника — со скидкой от тарифа «Оптимальный» (BASE) по
объёмной лесенке. Каждый сотрудник получает эквивалент «Оптимального».
"""
BASE = 1490  # цена за 1 сотрудника без скидки (тариф «Оптимальный»)
# (порог сотрудников, цена за сотрудника) — от большего к меньшему.
LADDER = [(100, 790), (50, 890), (25, 990), (10, 1090), (5, 1290)]
PORTRAITS_PER_SEAT = 80
STYLES_PER_SEAT = 8
MAX_HEADCOUNT = 100_000


def per_seat_price(headcount: int) -> int:
    for threshold, price in LADDER:
        if headcount >= threshold:
            return price
    return BASE


def team_quote(headcount: int) -> dict:
    n = max(1, min(int(headcount), MAX_HEADCOUNT))
    per = per_seat_price(n)
    total = n * per
    return {
        "headcount": n,
        "per_seat": per,
        "total": total,
        "discount": n * BASE - total,
        "percent": round((1 - per / BASE) * 100),
        "portraits_per_seat": PORTRAITS_PER_SEAT,
        "styles_per_seat": STYLES_PER_SEAT,
    }

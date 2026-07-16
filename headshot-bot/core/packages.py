"""Пакеты (тарифы). Разовая оплата, без подписки."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Package:
    code: str
    title: str
    price_rub: int
    portraits: int
    styles: int

    @property
    def price_kopeks(self) -> int:
        """Telegram Payments принимает сумму в минимальных единицах валюты."""
        return self.price_rub * 100

    def portraits_per_style(self) -> int:
        return self.portraits // self.styles


PACKAGES: dict[str, Package] = {
    p.code: p
    for p in (
        Package(code="standard", title="Стандарт", price_rub=990, portraits=40, styles=4),
        Package(code="pro", title="Про", price_rub=1490, portraits=80, styles=8),
    )
}


def get_package(code: str) -> Package:
    try:
        return PACKAGES[code]
    except KeyError:
        raise ValueError(f"Неизвестный пакет: {code!r}") from None

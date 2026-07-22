"""Пакеты (тарифы). Разовая оплата, без подписки."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Package:
    code: str
    title: str
    price_rub: int
    portraits: int
    styles: int      # число образов N (наряд+фон); клиент собирает пул, воркер даёт N
    remixes: int     # включённых перегенераций (remix) на заказ

    @property
    def price_kopeks(self) -> int:
        """Telegram Payments принимает сумму в минимальных единицах валюты."""
        return self.price_rub * 100

    def portraits_per_style(self) -> int:
        return self.portraits // self.styles


# Тройная сетка («Златовласка»): средний тариф — рекомендуемый, верхний — якорь.
# Код "pro" оставлен у среднего для совместимости с заказами в базе.
# styles = число образов; кадров на образ = portraits // styles (40/4=10, 70/7=10, 120/8=15).
PACKAGES: dict[str, Package] = {
    p.code: p
    for p in (
        Package(code="standard", title="Стандарт", price_rub=990,
                portraits=40, styles=4, remixes=2),
        Package(code="pro", title="Оптимальный", price_rub=1490,
                portraits=70, styles=7, remixes=4),
        Package(code="max", title="Максимум", price_rub=2490,
                portraits=120, styles=8, remixes=8),
    )
}

RECOMMENDED_CODE = "pro"


def get_package(code: str) -> Package:
    try:
        return PACKAGES[code]
    except KeyError:
        raise ValueError(f"Неизвестный пакет: {code!r}") from None

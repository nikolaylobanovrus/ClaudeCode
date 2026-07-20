import pytest

from core.packages import PACKAGES, get_package
from prompts.library import StyleLibrary


def test_known_packages():
    assert set(PACKAGES) == {"standard", "pro", "max"}
    std, pro, mx = PACKAGES["standard"], PACKAGES["pro"], PACKAGES["max"]
    assert std.price_rub < pro.price_rub < mx.price_rub
    assert std.portraits < pro.portraits < mx.portraits
    assert (std.price_rub, pro.price_rub, mx.price_rub) == (990, 1490, 2490)


def test_portraits_divide_evenly_by_styles():
    for p in PACKAGES.values():
        assert p.portraits_per_style() * p.styles == p.portraits


def test_price_kopeks():
    assert PACKAGES["standard"].price_kopeks == 99000


def test_unknown_package_raises():
    with pytest.raises(ValueError):
        get_package("enterprise")


def test_style_library_covers_biggest_package():
    styles = StyleLibrary.load()
    biggest = max(p.styles for p in PACKAGES.values())
    selected = styles.for_package(biggest)
    assert len(selected) == biggest
    assert len({s.key for s in selected}) == biggest
    assert styles.teaser_prompt
    for s in selected:
        assert "TOK" in s.prompt, f"стиль {s.key} без trigger word"

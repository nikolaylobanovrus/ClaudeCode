"""Каталог гардероба и сборка промпта из пулов одежды/фона."""
import pytest

from prompts.compose import build_looks, build_prompt, compose_looks
from prompts.wardrobe import WardrobeLibrary


@pytest.fixture
def lib():
    return WardrobeLibrary.load()


def test_catalog_sizes_and_unique_keys(lib):
    men = lib.clothing("male")
    women = lib.clothing("female")
    bg = lib.backgrounds()
    assert len(men) >= 90
    assert len(women) >= 90
    assert len(bg) >= 90
    keys = [c.key for c in men + women] + [b.key for b in bg]
    assert len(keys) == len(set(keys)), "ключи каталога должны быть уникальны"
    # Пол проставлен корректно.
    assert all(c.gender == "male" for c in men)
    assert all(c.gender == "female" for c in women)


def test_categories_nonempty(lib):
    assert lib.categories("clothing", "male")
    assert lib.categories("clothing", "female")
    assert lib.categories("background")


def test_resolve_unknown_key_raises(lib):
    good = lib.clothing("male")[0].key
    with pytest.raises(ValueError):
        lib.resolve("clothing", [good, "no_such_key"], "male")


def test_resolve_wrong_gender_raises(lib):
    male_key = lib.clothing("male")[0].key
    with pytest.raises(ValueError):
        lib.resolve("clothing", [male_key], "female")


def test_resolve_returns_in_request_order(lib):
    ks = [c.key for c in lib.clothing("male")[:3]]
    got = lib.resolve("clothing", list(reversed(ks)), "male")
    assert [c.key for c in got] == list(reversed(ks))


def test_build_prompt_contains_all_parts(lib):
    cl = lib.clothing("female")[0]
    bg = lib.backgrounds()[0]
    prompt = build_prompt("female", cl, bg)
    assert "TOK person" in prompt
    assert "woman" in prompt
    assert cl.fragment in prompt
    assert bg.fragment in prompt
    assert bg.lighting in prompt
    assert "85mm" in prompt  # хвост качества


def test_build_looks_distinct_and_count(lib):
    clothing = lib.clothing("male")[:4]
    backgrounds = lib.backgrounds()[:3]
    looks = build_looks(clothing, backgrounds, 7)
    assert len(looks) == 7
    # 4×3 = 12 ≥ 7 → все пары различны и разбросаны по обоим пулам.
    assert len({(c.key, b.key) for c, b in looks}) == 7
    assert len({c.key for c, _ in looks}) >= 3  # наряды разнообразны
    assert len({b.key for _, b in looks}) >= 2  # фоны разнообразны


def test_compose_looks_keys_and_prompts(lib):
    clothing = lib.clothing("male")[:3]
    backgrounds = lib.backgrounds()[:3]
    looks = compose_looks("male", clothing, backgrounds, 7)
    assert len(looks) == 7
    assert len({lk.key for lk in looks}) == 7  # стабильные уникальные ключи
    for lk in looks:
        assert lk.key.startswith("look")
        assert "TOK person" in lk.prompt
        assert "man" in lk.prompt


def test_build_looks_small_pool_cycles(lib):
    clothing = lib.clothing("male")[:1]
    backgrounds = lib.backgrounds()[:1]
    looks = build_looks(clothing, backgrounds, 4)  # 1×1 пул < 4 → циклим, не падаем
    assert len(looks) == 4

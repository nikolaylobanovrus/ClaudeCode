"""Массовая генерация превью каталога гардероба через Pollinations.ai (бесплатно,
без ключа). Гибрид: одежда — на обезличенной модели, фоны — пустые.

Кладёт JPEG 384×512 в web/static/img/wardrobe/{clothing|background}/{key}.jpg
(самохостинг: картинки в репозитории, рантайм от Pollinations не зависит).
Резюмируемый (пропускает готовые), с ретраями, лёгкой параллельностью.

  ./venv/bin/python tools/gen_wardrobe_thumbs.py [--only clothing|background]
      [--limit N] [--overwrite] [--workers 4]
"""
import argparse
import io
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import ProxyHandler, build_opener, getproxies

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from prompts.wardrobe import WardrobeLibrary  # noqa: E402

OUT = ROOT / "web" / "static" / "img" / "wardrobe"
CA_BUNDLE = "/root/.ccr/ca-bundle.crt"
W, H = 384, 512          # размер хранимого превью
GEN_W, GEN_H = 768, 1024  # генерируем крупнее и уменьшаем → чётче и красивее лицо

_opener = build_opener(ProxyHandler(getproxies()))


def _stable_seed(key: str) -> int:
    # Детерминированный seed без hash() (рандомизирован от запуска к запуску).
    s = 0
    for ch in key:
        s = (s * 131 + ord(ch)) % 1_000_000
    return s


def _clothing_prompt(gender: str, fragment: str) -> str:
    who = "a businesswoman" if gender == "female" else "a businessman"
    outfit = fragment.replace("wearing ", "", 1)
    # Кадрирование как у HeadshotPro: waist-up, срез по талии; лицо крупное,
    # в фокусе, смотрит в камеру; фон ровный светло-серый.
    return (
        f"professional corporate headshot portrait of {who} {outfit}, "
        f"waist-up composition cropped at the waist, only head shoulders and upper torso in frame, "
        f"no legs, face large and prominent in the upper part of the frame, "
        f"beautiful natural realistic face, healthy skin with natural texture, "
        f"warm confident friendly expression, looking directly at the camera, well groomed, "
        f"plain light grey seamless studio background, "
        f"soft even studio lighting with subtle catchlights in the eyes, "
        f"shot on 85mm portrait lens, shallow depth of field, sharp focus on the face, "
        f"photorealistic, ultra detailed, clean, no text, no watermark"
    )


# Единая «модель» на всех фонах (как у HeadshotPro): фиксированное описание +
# фиксированный seed на пол → узнаваемо один и тот же человек на разных фонах.
_BG_MODEL = {
    "male": "a businessman with short dark brown hair, clean-shaven, "
            "wearing a plain charcoal suit and a white shirt",
    "female": "a businesswoman with shoulder-length brown hair, "
              "wearing a plain black blazer over a white top",
}
_BG_SEED = {"male": 314159, "female": 271828}


def _background_prompt(gender: str, fragment: str, lighting: str) -> str:
    # fragment вида «against a … backdrop» / «in a … office» — вставляем как есть,
    # человек стоит НА этом фоне (waist-up, лицо крупное).
    return (
        f"professional corporate headshot portrait of {_BG_MODEL[gender]}, "
        f"waist-up composition cropped at the waist, only head shoulders and upper torso in frame, "
        f"{fragment}, {lighting}, the background clearly visible behind the person, "
        f"face large and prominent, beautiful natural realistic face, healthy skin with natural texture, "
        f"warm confident friendly expression, looking directly at the camera, "
        f"shot on 85mm portrait lens, shallow depth of field, sharp focus on the face, "
        f"photorealistic, ultra detailed, no text, no watermark"
    )


_REFERRER = "d-portret.ru"
_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Referer": "https://d-portret.ru"}


def _pollinations_url(prompt: str, seed: int) -> str:
    enc = urllib.parse.quote(prompt, safe="")
    return (f"https://image.pollinations.ai/prompt/{enc}"
            f"?width={GEN_W}&height={GEN_H}&seed={seed}&nologo=true&model=flux"
            f"&referrer={_REFERRER}")


def _fetch(url: str, tries: int = 4) -> bytes:
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            with _opener.open(req, timeout=120) as r:
                data = r.read()
            if len(data) > 2000:  # отсекаем страницы-ошибки
                return data
            last = RuntimeError(f"слишком маленький ответ ({len(data)} б)")
        except Exception as e:  # noqa: BLE001
            last = e
        time.sleep(2 * (i + 1))
    raise last  # type: ignore[misc]


def _save(data: bytes, path: Path) -> None:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img = img.resize((W, H), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="JPEG", quality=80, optimize=True)


def _tasks(lib: WardrobeLibrary, only: str | None):
    """Список задач: (relpath, seed, prompt). relpath — путь под OUT без .jpg."""
    out = []
    if only in (None, "clothing"):
        for gender in ("male", "female"):
            for c in lib.clothing(gender):
                out.append((f"clothing/{c.key}", _stable_seed(c.key),
                            _clothing_prompt(gender, c.fragment)))
    if only in (None, "background"):
        # Свой набор фонов на каждый пол (один и тот же человек на всех фонах).
        for gender in ("male", "female"):
            for b in lib.backgrounds():
                out.append((f"background/{gender}/{b.key}", _BG_SEED[gender],
                            _background_prompt(gender, b.fragment, b.lighting)))
    return out


def _one(relpath: str, seed: int, prompt: str, overwrite: bool) -> str:
    path = OUT / f"{relpath}.jpg"
    if path.exists() and not overwrite:
        return f"skip {relpath}"
    data = _fetch(_pollinations_url(prompt, seed))
    _save(data, path)
    return f"ok   {relpath} ({path.stat().st_size // 1024} КБ)"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["clothing", "background"])
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()

    lib = WardrobeLibrary.load()
    tasks = _tasks(lib, a.only)
    if a.limit:
        tasks = tasks[:a.limit]
    print(f"Всего позиций: {len(tasks)} (workers={a.workers})", flush=True)

    done = fail = 0
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(_one, rel, seed, pr, a.overwrite): rel
                for rel, seed, pr in tasks}
        for i, fut in enumerate(as_completed(futs), 1):
            rel = futs[fut]
            try:
                msg = fut.result()
                done += 1
            except Exception as e:  # noqa: BLE001
                msg = f"FAIL {rel}: {e}"
                fail += 1
            print(f"[{i}/{len(tasks)}] {msg}", flush=True)

    print(f"Готово: {done} ок, {fail} ошибок", flush=True)


if __name__ == "__main__":
    main()

"""Валидация загружаемых селфи.

Базовые проверки на PIL (размер, яркость, формат) работают всегда.
Детекция лица через opencv (haar cascade) подключается, если установлен
opencv-python; без него проверка лица мягко пропускается — качество
контролируется на этапе тренировки.
"""
from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageStat

MIN_SIDE_PX = 512
MIN_BRIGHTNESS = 30  # средняя яркость 0..255
MAX_BRIGHTNESS = 235

try:  # опциональная зависимость
    import cv2
    import numpy as np

    _FACE_CASCADE = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
except Exception:  # pragma: no cover - окружение без opencv
    cv2 = None
    _FACE_CASCADE = None


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    reason: str | None = None  # ключ причины для текстов бота


def _detect_face(img: Image.Image) -> bool | None:
    """True/False — результат детекции, None — детектор недоступен."""
    if _FACE_CASCADE is None or _FACE_CASCADE.empty():
        return None
    gray = np.array(img.convert("L"))
    faces = _FACE_CASCADE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
    return len(faces) > 0


def validate_photo(data: bytes) -> ValidationResult:
    try:
        img = Image.open(BytesIO(data))
        img.load()
    except Exception:
        return ValidationResult(False, "not_an_image")

    if min(img.size) < MIN_SIDE_PX:
        return ValidationResult(False, "too_small")

    brightness = ImageStat.Stat(img.convert("L")).mean[0]
    if brightness < MIN_BRIGHTNESS:
        return ValidationResult(False, "too_dark")
    if brightness > MAX_BRIGHTNESS:
        return ValidationResult(False, "too_bright")

    if _detect_face(img) is False:
        return ValidationResult(False, "no_face")

    return ValidationResult(True)

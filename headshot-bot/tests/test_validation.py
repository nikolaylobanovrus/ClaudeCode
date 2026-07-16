from io import BytesIO

from PIL import Image

from core.validation import validate_photo


def make_photo(size=(768, 1024), color=(128, 110, 100)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, color).save(buf, format="JPEG")
    return buf.getvalue()


def test_valid_photo_passes_basic_checks():
    result = validate_photo(make_photo())
    # Без opencv лицо не проверяется; базовые проверки должны пройти.
    assert result.ok or result.reason == "no_face"


def test_garbage_rejected():
    assert validate_photo(b"definitely not a jpeg").reason == "not_an_image"


def test_too_small_rejected():
    assert validate_photo(make_photo(size=(300, 400))).reason == "too_small"


def test_too_dark_rejected():
    assert validate_photo(make_photo(color=(5, 5, 5))).reason == "too_dark"


def test_too_bright_rejected():
    assert validate_photo(make_photo(color=(250, 250, 250))).reason == "too_bright"

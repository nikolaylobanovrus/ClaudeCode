"""Загрузка библиотеки стилей из styles.yaml."""
from dataclasses import dataclass
from pathlib import Path

import yaml

_STYLES_PATH = Path(__file__).parent / "styles.yaml"


@dataclass(frozen=True)
class Style:
    key: str
    title: str
    prompt: str


class StyleLibrary:
    def __init__(self, teaser_prompt: str, styles: list[Style]):
        self.teaser_prompt = teaser_prompt
        self.styles = styles

    @classmethod
    def load(cls, path: Path = _STYLES_PATH) -> "StyleLibrary":
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        styles = [Style(s["key"], s["title"], s["prompt"].strip()) for s in raw["styles"]]
        if not styles:
            raise ValueError("styles.yaml не содержит стилей")
        return cls(teaser_prompt=raw["teaser_prompt"].strip(), styles=styles)

    def for_package(self, style_count: int) -> list[Style]:
        if style_count > len(self.styles):
            raise ValueError(
                f"Пакету нужно {style_count} стилей, в библиотеке только {len(self.styles)}"
            )
        return self.styles[:style_count]

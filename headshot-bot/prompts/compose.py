"""Сборка промпта для fal из выбранных пула одежды и пула фонов.

Клиент выбирает ПУЛ нарядов и ПУЛ фонов (мультивыбор). Наш воркер формирует ровно
N образов (`build_looks`), разнообразно комбинируя пул: каждый образ = 1 наряд + 1 фон.
Для каждого образа `build_prompt` собирает промпт, сохраняя триггер обученной LoRA
`TOK person` и хвост качества. `compose_looks` — точка входа для воркера: принимает
уже разрешённые позиции каталога и отдаёт список `Look` с готовым промптом и ключом.
"""
from dataclasses import dataclass

from prompts.wardrobe import Background, Clothing

# Ротация выражения/ракурса по образам, чтобы разные образы не были однотипны.
LOOK_VARIATIONS = [
    "with a confident subtle smile, looking directly at the camera",
    "with a warm friendly smile, looking at the camera",
    "with a calm approachable expression, looking directly at the camera",
    "with a relaxed natural smile, head slightly turned",
    "with a composed professional expression, looking at the camera",
    "with a friendly open expression, slight three-quarter angle",
    "with a poised confident look, looking directly at the camera",
    "with a genuine warm expression, looking at the camera",
]

# Общий хвост качества — держим единым для всех образов.
QUALITY_TAIL = (
    "head-and-shoulders composition, shot on 85mm f/1.8 portrait lens, "
    "shallow depth of field, soft flattering lighting with subtle catchlights in the eyes, "
    "natural realistic skin texture, sharp focus on the face, "
    "clean professional color grading, photorealistic, ultra-detailed, high resolution"
)

_GENDER = {"male": "man", "female": "woman"}


def build_prompt(gender: str, clothing: Clothing, background: Background,
                 variation: str | None = None) -> str:
    """Полный промпт одного образа. Сохраняет `TOK person` и хвост качества."""
    who = _GENDER.get(gender, "person")
    variation = variation or LOOK_VARIATIONS[0]
    parts = [
        "professional corporate headshot photo of TOK person,",
        f"a confident {who},",
        f"{clothing.fragment},",
        f"{background.fragment},",
        f"{background.lighting},",
        f"{variation},",
        QUALITY_TAIL,
    ]
    return " ".join(parts)


@dataclass(frozen=True)
class Look:
    key: str            # "look{i}_{clothing_key}__{background_key}" — стабильный для резюма
    prompt: str
    clothing_key: str
    background_key: str


def build_looks(clothing: list[Clothing], backgrounds: list[Background],
                n: int) -> list[tuple[Clothing, Background]]:
    """N пар (наряд, фон) с разбросом по обоим пулам (анти-диагональ декартова
    произведения). Требует |clothing|·|backgrounds| ≥ n (проверяется выше)."""
    if not clothing or not backgrounds:
        raise ValueError("Нужен хотя бы один наряд и один фон")
    c, b = len(clothing), len(backgrounds)
    grid = [(i, j) for i in range(c) for j in range(b)]
    # Анти-диагональ: первые выбранные пары максимально разнообразят и наряд, и фон.
    grid.sort(key=lambda p: ((p[0] + p[1]) % max(c, b), p[0], p[1]))
    pairs = [(clothing[i], backgrounds[j]) for i, j in grid]
    if n <= len(pairs):
        return pairs[:n]
    # Пул мал — циклим (валидация обычно это исключает, но не падаем).
    return [pairs[k % len(pairs)] for k in range(n)]


def compose_looks(gender: str, clothing: list[Clothing], backgrounds: list[Background],
                  n: int) -> list[Look]:
    """Готовые образы для воркера: пары → промпты. Точка входа генерации."""
    looks: list[Look] = []
    for i, (cl, bg) in enumerate(build_looks(clothing, backgrounds, n)):
        variation = LOOK_VARIATIONS[i % len(LOOK_VARIATIONS)]
        looks.append(Look(
            key=f"look{i}_{cl.key}__{bg.key}",
            prompt=build_prompt(gender, cl, bg, variation),
            clothing_key=cl.key,
            background_key=bg.key,
        ))
    return looks

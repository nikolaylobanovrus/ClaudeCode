"""Каталог гардероба (одежда) и фонов для веб-конструктора образов.

Позиции генерируются программно из категорий × атрибутов — не 300 строк руками.
Каждая позиция несёт RU-название (`label`, для UI) и EN-фрагмент (`fragment`,
подставляется в промпт для fal). Одежда разделена по полу; фоны общие и несут
подсказку света (`lighting`) для промпта.

`WardrobeLibrary.load()` собирает каталог и валидирует ключи (`resolve`), по
образцу `prompts/library.py::StyleLibrary`.
"""
from dataclasses import dataclass


def _slug(*parts: str) -> str:
    return "_".join(parts)


@dataclass(frozen=True)
class Clothing:
    key: str
    label: str      # RU для UI
    fragment: str   # EN для промпта, начинается с "wearing ..."
    category: str   # RU категория (табы/фильтр)
    gender: str     # "male" | "female"


@dataclass(frozen=True)
class Background:
    key: str
    label: str
    fragment: str   # EN для промпта, начинается с "in/against ..."
    category: str
    lighting: str   # EN подсказка света для промпта


# ---------- словари атрибутов (RU, EN) ----------

_SUIT_COLORS = [
    ("тёмно-синий", "navy blue"), ("угольный", "charcoal"), ("чёрный", "black"),
    ("серый", "medium grey"), ("светло-серый", "light grey"), ("синий", "cobalt blue"),
    ("коричневый", "brown"), ("оливковый", "olive"), ("бордовый", "burgundy"),
    ("бежевый", "beige"),
]
_SHIRT = [("белая рубашка", "a crisp white dress shirt"),
          ("голубая рубашка", "a light blue dress shirt")]
_TIE = [("бордовый галстук", "a burgundy tie"), ("тёмно-синий галстук", "a navy tie"),
        ("без галстука", "an open collar without a tie")]
_SHIRT_COLORS = [
    ("белая", "white"), ("голубая", "light blue"), ("бледно-розовая", "pale pink"),
    ("лавандовая", "lavender"), ("светло-серая", "light grey"), ("чёрная", "black"),
    ("в тонкую полоску", "subtly striped light blue"),
]
_KNIT_COLORS = [
    ("серый", "grey"), ("тёмно-синий", "navy"), ("угольный", "charcoal"),
    ("кэмел", "camel"), ("бордовый", "burgundy"), ("тёмно-зелёный", "forest green"),
    ("кремовый", "cream"), ("бежевый", "beige"),
]
_COAT_COLORS = [("кэмел", "camel"), ("угольный", "charcoal"), ("тёмно-синий", "navy"),
                ("серый", "grey"), ("бежевый", "beige")]

_W_BLAZER_COLORS = [
    ("бежевый", "beige"), ("чёрный", "black"), ("тёмно-синий", "navy"),
    ("серый", "grey"), ("белый", "white"), ("пудровый", "blush pink"),
    ("бордовый", "burgundy"), ("изумрудный", "emerald"), ("кэмел", "camel"),
    ("светло-серый", "light grey"),
]
_W_BLOUSE = [("белая шёлковая", "a white silk blouse"), ("кремовая", "a cream blouse"),
             ("голубая", "a light blue blouse")]
_W_BLOUSE_COLORS = [
    ("белая шёлковая", "white silk"), ("кремовая", "cream"), ("голубая", "light blue"),
    ("пудровая", "blush pink"), ("изумрудная", "emerald"), ("бордовая", "burgundy"),
    ("чёрная", "black"), ("серо-голубая", "dusty blue"),
]
_W_DRESS_COLORS = [
    ("тёмно-синее", "navy blue"), ("чёрное", "black"), ("бордовое", "burgundy"),
    ("изумрудное", "emerald"), ("серое", "grey"), ("бежевое", "beige"),
    ("тёмно-зелёное", "dark green"), ("сливовое", "plum")]
_W_KNIT_COLORS = [
    ("кремовый", "cream"), ("серый", "grey"), ("кэмел", "camel"), ("чёрный", "black"),
    ("тёмно-синий", "navy"), ("пудровый", "blush pink"), ("бордовый", "burgundy"),
    ("бежевый", "beige")]


def _build_men() -> list[Clothing]:
    out: list[Clothing] = []
    # Костюмы
    for i, (rc, ec) in enumerate(_SUIT_COLORS):
        out.append(Clothing(_slug("m", "suit", str(i), "wb"),
            f"{rc.capitalize()} костюм, белая рубашка, бордовый галстук",
            f"wearing a tailored {ec} two-piece business suit with a crisp white shirt and a burgundy tie",
            "Костюмы", "male"))
        out.append(Clothing(_slug("m", "suit", str(i), "bl"),
            f"{rc.capitalize()} костюм, голубая рубашка",
            f"wearing a tailored {ec} two-piece business suit with a light blue shirt and a navy tie",
            "Костюмы", "male"))
    for i, rc, ec in [(0, "тёмно-синий", "navy"), (1, "угольный", "charcoal"), (2, "серый", "grey")]:
        out.append(Clothing(_slug("m", "suit3", str(i)),
            f"{rc.capitalize()} костюм-тройка",
            f"wearing an elegant {ec} three-piece business suit with a waistcoat, white shirt and a silk tie",
            "Костюмы", "male"))
    # Пиджак + рубашка
    for i, (rc, ec) in enumerate(_SUIT_COLORS[:8]):
        out.append(Clothing(_slug("m", "blazer", str(i)),
            f"{rc.capitalize()} пиджак, рубашка",
            f"wearing a {ec} blazer over a white dress shirt with an open collar",
            "Пиджак и рубашка", "male"))
    # Рубашки
    for i, (rc, ec) in enumerate(_SHIRT_COLORS):
        out.append(Clothing(_slug("m", "shirt", str(i)),
            f"Рубашка, {rc}",
            f"wearing a {ec} dress shirt with the top button open, no jacket",
            "Рубашки", "male"))
        out.append(Clothing(_slug("m", "shirt", str(i), "tie"),
            f"Рубашка {rc} с галстуком",
            f"wearing a {ec} dress shirt with a dark tie, no jacket",
            "Рубашки", "male"))
    # Свитеры и водолазки
    for i, (rc, ec) in enumerate(_KNIT_COLORS):
        out.append(Clothing(_slug("m", "sweater", str(i)),
            f"{rc.capitalize()} свитер поверх рубашки",
            f"wearing a {ec} fine-knit sweater over a collared shirt",
            "Свитеры", "male"))
    for i, (rc, ec) in enumerate(_KNIT_COLORS[:6]):
        out.append(Clothing(_slug("m", "turtle", str(i)),
            f"{rc.capitalize()} водолазка",
            f"wearing a {ec} fine-knit turtleneck",
            "Свитеры", "male"))
    # Смарт-кэжуал
    for i, (rc, ec) in enumerate(_KNIT_COLORS[:6]):
        out.append(Clothing(_slug("m", "casual_blazer", str(i)),
            f"{rc.capitalize()} пиджак поверх футболки",
            f"wearing a {ec} unstructured blazer over a plain white t-shirt",
            "Смарт-кэжуал", "male"))
    for i, (rc, ec) in enumerate([("тёмно-синее", "navy"), ("белое", "white"),
                                  ("чёрное", "black"), ("серое", "grey")]):
        out.append(Clothing(_slug("m", "polo", str(i)),
            f"{rc.capitalize()} поло",
            f"wearing a {ec} pique polo shirt",
            "Смарт-кэжуал", "male"))
    # Верхняя одежда
    for i, (rc, ec) in enumerate(_COAT_COLORS):
        out.append(Clothing(_slug("m", "coat", str(i)),
            f"{rc.capitalize()} пальто поверх костюма",
            f"wearing a {ec} wool overcoat over a dark suit",
            "Верхняя одежда", "male"))
    # Двубортные костюмы
    for i, rc, ec in [(0, "тёмно-синий", "navy"), (1, "угольный", "charcoal"),
                      (2, "серый", "grey"), (3, "чёрный", "black")]:
        out.append(Clothing(_slug("m", "db_suit", str(i)),
            f"{rc.capitalize()} двубортный костюм",
            f"wearing a sharp {ec} double-breasted business suit with a white shirt",
            "Костюмы", "male"))
    # Смокинг / вечерний
    for i, rc, ec in [(0, "чёрный", "black"), (1, "тёмно-синий", "midnight blue")]:
        out.append(Clothing(_slug("m", "tux", str(i)),
            f"{rc.capitalize()} смокинг, бабочка",
            f"wearing an elegant {ec} tuxedo with a black bow tie",
            "Костюмы", "male"))
    # Жилет + рубашка (без пиджака)
    for i, (rc, ec) in enumerate(_SUIT_COLORS[:5]):
        out.append(Clothing(_slug("m", "vest", str(i)),
            f"{rc.capitalize()} жилет поверх рубашки",
            f"wearing a {ec} tailored waistcoat over a white dress shirt and a tie, no jacket",
            "Пиджак и рубашка", "male"))
    # Кардиганы
    for i, (rc, ec) in enumerate(_KNIT_COLORS[:5]):
        out.append(Clothing(_slug("m", "cardigan", str(i)),
            f"{rc.capitalize()} кардиган поверх рубашки",
            f"wearing a {ec} knit cardigan over a collared shirt",
            "Свитеры", "male"))
    # Смарт-кэжуал: куртка, лён, шамбре
    for i, rc, ec in [(0, "тёмно-синий", "navy"), (1, "оливковый", "olive"),
                      (2, "чёрный", "black")]:
        out.append(Clothing(_slug("m", "smart_jacket", str(i)),
            f"{rc.capitalize()} куртка-бомбер поверх футболки",
            f"wearing a smart {ec} bomber jacket over a plain t-shirt",
            "Смарт-кэжуал", "male"))
    for i, rc, ec in [(0, "бежевый", "beige"), (1, "светло-голубой", "light blue"),
                      (2, "белый", "white")]:
        out.append(Clothing(_slug("m", "linen", str(i)),
            f"{rc.capitalize()} льняной пиджак",
            f"wearing a relaxed {ec} linen summer blazer over a light shirt",
            "Смарт-кэжуал", "male"))
    for i, rc, ec in [(0, "голубая", "light blue chambray"), (1, "синяя", "indigo denim")]:
        out.append(Clothing(_slug("m", "chambray", str(i)),
            f"{rc.capitalize()} джинсовая рубашка",
            f"wearing a {ec} casual shirt with the top button open",
            "Рубашки", "male"))
    return out


def _build_women() -> list[Clothing]:
    out: list[Clothing] = []
    # Блейзеры
    for i, (rc, ec) in enumerate(_W_BLAZER_COLORS):
        out.append(Clothing(_slug("w", "blazer", str(i)),
            f"{rc.capitalize()} блейзер, белая блуза",
            f"wearing a tailored {ec} blazer over a white silk blouse",
            "Блейзеры", "female"))
        out.append(Clothing(_slug("w", "blazer", str(i), "c"),
            f"{rc.capitalize()} блейзер, кремовая блуза",
            f"wearing a tailored {ec} blazer over a cream blouse",
            "Блейзеры", "female"))
    # Блузки
    for i, (rc, ec) in enumerate(_W_BLOUSE_COLORS):
        out.append(Clothing(_slug("w", "blouse", str(i)),
            f"Блуза, {rc}",
            f"wearing an elegant {ec} blouse, no jacket",
            "Блузки", "female"))
    # Платья
    for i, (rc, ec) in enumerate(_W_DRESS_COLORS):
        out.append(Clothing(_slug("w", "dress", str(i)),
            f"{rc.capitalize()} деловое платье",
            f"wearing an elegant {ec} business sheath dress",
            "Платья", "female"))
        out.append(Clothing(_slug("w", "dress", str(i), "blz"),
            f"{rc.capitalize()} платье с жакетом",
            f"wearing an elegant {ec} sheath dress with a matching tailored jacket",
            "Платья", "female"))
    # Костюмы
    for i, (rc, ec) in enumerate(_W_BLAZER_COLORS[:8]):
        out.append(Clothing(_slug("w", "suit", str(i)),
            f"{rc.capitalize()} костюм",
            f"wearing a {ec} women's business trouser suit with a white blouse",
            "Костюмы", "female"))
    # Трикотаж
    for i, (rc, ec) in enumerate(_W_KNIT_COLORS):
        out.append(Clothing(_slug("w", "knit", str(i)),
            f"{rc.capitalize()} трикотаж",
            f"wearing a {ec} fine-knit sweater",
            "Трикотаж", "female"))
    for i, (rc, ec) in enumerate(_W_KNIT_COLORS[:6]):
        out.append(Clothing(_slug("w", "turtle", str(i)),
            f"{rc.capitalize()} водолазка",
            f"wearing a {ec} fine-knit turtleneck",
            "Трикотаж", "female"))
    # Смарт-кэжуал
    for i, (rc, ec) in enumerate(_W_BLAZER_COLORS[:8]):
        out.append(Clothing(_slug("w", "casual", str(i)),
            f"{rc.capitalize()} блейзер поверх топа",
            f"wearing a relaxed {ec} blazer over a fitted knit top",
            "Смарт-кэжуал", "female"))
    # Платья-рубашки
    for i, rc, ec in [(0, "тёмно-синее", "navy"), (1, "чёрное", "black"),
                      (2, "изумрудное", "emerald"), (3, "бежевое", "beige")]:
        out.append(Clothing(_slug("w", "shirtdress", str(i)),
            f"{rc.capitalize()} платье-рубашка",
            f"wearing an elegant {ec} tailored shirt dress",
            "Платья", "female"))
    # Трикотажные платья
    for i, rc, ec in [(0, "кремовое", "cream"), (1, "серое", "grey"),
                      (2, "чёрное", "black"), (3, "кэмел", "camel")]:
        out.append(Clothing(_slug("w", "knitdress", str(i)),
            f"{rc.capitalize()} трикотажное платье",
            f"wearing a refined {ec} fitted knit dress",
            "Платья", "female"))
    # Твидовые жакеты
    for i, rc, ec in [(0, "молочный", "cream tweed"), (1, "серый", "grey tweed"),
                      (2, "розовый", "pink tweed"), (3, "тёмно-синий", "navy tweed")]:
        out.append(Clothing(_slug("w", "tweed", str(i)),
            f"{rc.capitalize()} твидовый жакет",
            f"wearing an elegant {ec} tweed jacket over a silk blouse",
            "Блейзеры", "female"))
    # Блузы с бантом
    for i, rc, ec in [(0, "белая", "white"), (1, "кремовая", "cream"),
                      (2, "пудровая", "blush pink"), (3, "тёмно-синяя", "navy")]:
        out.append(Clothing(_slug("w", "bow", str(i)),
            f"{rc.capitalize()} блуза с бантом",
            f"wearing an elegant {ec} pussy-bow blouse",
            "Блузки", "female"))
    # Жилеты
    for i, rc, ec in [(0, "серый", "grey"), (1, "тёмно-синий", "navy"),
                      (2, "бежевый", "beige"), (3, "чёрный", "black")]:
        out.append(Clothing(_slug("w", "vest", str(i)),
            f"{rc.capitalize()} жилет поверх блузы",
            f"wearing a tailored {ec} waistcoat over a white blouse, no jacket",
            "Смарт-кэжуал", "female"))
    # Пальто
    for i, rc, ec in [(0, "кэмел", "camel"), (1, "серое", "grey"),
                      (2, "тёмно-синее", "navy"), (3, "белое", "white"),
                      (4, "чёрное", "black"), (5, "бордовое", "burgundy")]:
        out.append(Clothing(_slug("w", "coat", str(i)),
            f"{rc.capitalize()} пальто",
            f"wearing an elegant {ec} tailored wool coat over business attire",
            "Верхняя одежда", "female"))
    return out


def _build_backgrounds() -> list[Background]:
    out: list[Background] = []
    studio = "soft even studio lighting"
    for i, (rc, ec) in enumerate([
        ("серый", "medium grey"), ("светло-серый", "light grey"), ("тёмно-серый", "dark grey"),
        ("угольный", "charcoal"), ("белый", "clean white"), ("молочный", "off-white"),
        ("синий", "deep blue"), ("тёмно-синий", "navy"), ("бирюзовый", "teal"),
        ("бежевый", "warm beige"), ("чёрный", "black"), ("тёмно-зелёный", "deep green"),
        ("бордовый", "burgundy"), ("сливовый", "plum"), ("песочный", "sand"),
        ("графитовый", "graphite"), ("небесно-голубой", "sky blue"), ("оливковый", "olive")]):
        out.append(Background(_slug("bg", "studio", str(i)), f"Студия, {rc} фон",
            f"against a seamless {ec} studio backdrop", "Студия", studio))
    for i, (rc, ec) in enumerate([
        ("серый", "grey"), ("синий", "blue"), ("бежевый", "beige"), ("тёплый", "warm brown")]):
        out.append(Background(_slug("bg", "gradient", str(i)), f"Студия, градиент ({rc})",
            f"against a smooth {ec} gradient studio backdrop", "Студия", studio))
    # Офис
    for i, (rl, ef, lg) in enumerate([
        ("светлый современный офис", "in a bright modern corporate office with softly blurred glass walls", "soft natural window light"),
        ("тёплый кабинет с полками", "in a warm executive office with blurred bookshelves", "warm ambient light"),
        ("open-space", "in a blurred open-plan office with soft bokeh", "soft daylight"),
        ("переговорная", "in a modern meeting room with a blurred glass wall", "soft even light"),
        ("лобби бизнес-центра", "in a bright corporate lobby with soft bokeh", "soft daylight"),
        ("офис с панорамой города", "in a modern office with blurred city skyline through the window", "soft window light"),
        ("тёмный премиум-кабинет", "in a dark upscale office with warm blurred lighting", "warm rim light"),
        ("офис с зеленью", "in a bright office with blurred green plants", "soft daylight")]):
        out.append(Background(_slug("bg", "office", str(i)), f"Офис — {rl}", ef, "Офис", lg))
    # Улица / город
    for i, (rl, ef, lg) in enumerate([
        ("город, золотой час", "against a blurred city street at golden hour with soft bokeh", "warm golden-hour rim light"),
        ("стеклянные небоскрёбы", "against blurred modern glass skyscrapers", "soft daylight"),
        ("городская площадь", "against a blurred urban plaza with bokeh", "soft daylight"),
        ("вечерний город с огнями", "against a blurred evening city with warm bokeh lights", "warm cinematic light"),
        ("исторический центр", "against a blurred historic european street", "soft daylight"),
        ("набережная", "against a blurred waterfront promenade", "soft daylight"),
        ("мост", "against a blurred city bridge with bokeh", "soft daylight")]):
        out.append(Background(_slug("bg", "city", str(i)), f"Город — {rl}", ef, "Улица", lg))
    # Природа
    for i, (rl, ef, lg) in enumerate([
        ("зелёный парк", "against a soft blurred green park background", "soft natural daylight"),
        ("осенняя листва", "against blurred warm autumn foliage with bokeh", "soft warm daylight"),
        ("пляж, золотой час", "against a blurred beach at golden hour", "warm golden-hour light"),
        ("сад", "against a blurred lush garden with bokeh", "soft daylight"),
        ("хвойный лес", "against a blurred evergreen forest", "soft diffused light"),
        ("поле на закате", "against a blurred field at sunset", "warm sunset light")]):
        out.append(Background(_slug("bg", "nature", str(i)), f"Природа — {rl}", ef, "Природа", lg))
    # Абстракция / боке
    for i, (rc, ec) in enumerate([
        ("тёплое", "warm"), ("холодное", "cool blue"), ("золотое", "golden"),
        ("зелёное", "green"), ("розовое", "pink"), ("нейтральное", "neutral grey"),
        ("синее", "deep blue"), ("сиреневое", "purple")]):
        out.append(Background(_slug("bg", "bokeh", str(i)), f"Боке, {rc}",
            f"against a soft {ec} bokeh abstract background", "Абстракция",
            "soft cinematic light"))
    # Одноцветный
    for i, (rc, ec) in enumerate([
        ("тёмно-синий", "navy"), ("изумрудный", "emerald"), ("бордовый", "burgundy"),
        ("горчичный", "mustard"), ("терракотовый", "terracotta"), ("серо-голубой", "slate blue"),
        ("угольный", "charcoal"), ("тёплый серый", "warm grey")]):
        out.append(Background(_slug("bg", "solid", str(i)), f"Однотонный, {rc}",
            f"against a solid {ec} background", "Однотонный", studio))
    # Лофт / кирпич
    for i, (rl, ef, lg) in enumerate([
        ("красный кирпич", "against a rustic exposed red brick wall", "warm side light"),
        ("белый кирпич", "against a white painted brick wall", "soft daylight"),
        ("бетон-лофт", "against a concrete loft wall", "soft directional light"),
        ("дерево-индастриал", "against a warm wooden industrial wall", "warm ambient light"),
        ("тёмный лофт", "against a dark moody industrial wall", "warm rim light")]):
        out.append(Background(_slug("bg", "loft", str(i)), f"Лофт — {rl}", ef, "Лофт", lg))
    # Ещё офисы
    for i, (rl, ef, lg) in enumerate([
        ("ресепшн", "in a modern office reception area with soft bokeh", "soft daylight"),
        ("кабинет руководителя", "in a spacious executive suite with blurred furniture", "warm ambient light"),
        ("коворкинг", "in a bright airy coworking space with soft bokeh", "soft daylight"),
        ("офис с кирпичом", "in a modern loft office with blurred brick wall", "warm side light")]):
        out.append(Background(_slug("bg", "office2", str(i)), f"Офис — {rl}", ef, "Офис", lg))
    # Ещё город
    for i, (rl, ef, lg) in enumerate([
        ("деловой квартал", "against a blurred financial district with glass towers", "soft daylight"),
        ("уличное кафе", "against a blurred street cafe with warm bokeh", "warm ambient light"),
        ("парковая аллея", "against a blurred tree-lined city avenue", "soft dappled light"),
        ("ночные огни", "against blurred night city lights with bokeh", "cool cinematic light")]):
        out.append(Background(_slug("bg", "city2", str(i)), f"Город — {rl}", ef, "Улица", lg))
    # Ещё природа
    for i, (rl, ef, lg) in enumerate([
        ("горы", "against blurred distant mountains", "soft cool daylight"),
        ("озеро", "against a blurred calm lake", "soft daylight"),
        ("цветущий сад", "against a blurred blossoming garden", "soft warm daylight"),
        ("зелёная стена", "against a lush green foliage wall", "soft even daylight")]):
        out.append(Background(_slug("bg", "nature2", str(i)), f"Природа — {rl}", ef, "Природа", lg))
    # Текстуры / премиум
    for i, (rl, ef, lg) in enumerate([
        ("белый мрамор", "against an elegant white marble wall", "soft even light"),
        ("тёмный мрамор", "against a dark marble wall", "warm rim light"),
        ("бетон", "against a smooth minimalist concrete wall", "soft directional light"),
        ("дерево-панели", "against warm wooden wall panelling", "warm ambient light"),
        ("шторы", "against elegant soft draped curtains", "soft studio light"),
        ("книжные полки", "against a wall of blurred library bookshelves", "warm ambient light")]):
        out.append(Background(_slug("bg", "texture", str(i)), f"Текстура — {rl}", ef, "Интерьер", lg))
    # Ещё однотонные и боке
    for i, (rc, ec) in enumerate([
        ("глубокий синий", "deep blue"), ("шалфейный", "sage green"),
        ("пыльно-розовый", "dusty rose"), ("кофейный", "coffee brown"),
        ("тёмно-серый", "dark grey"), ("бирюзовый", "teal")]):
        out.append(Background(_slug("bg", "solid2", str(i)), f"Однотонный, {rc}",
            f"against a solid {ec} background", "Однотонный", studio))
    for i, (rc, ec) in enumerate([
        ("серебристое", "silver"), ("тёплое янтарное", "warm amber"),
        ("бирюзовое", "teal"), ("сиренево-розовое", "lilac")]):
        out.append(Background(_slug("bg", "bokeh2", str(i)), f"Боке, {rc}",
            f"against a soft {ec} bokeh abstract background", "Абстракция",
            "soft cinematic light"))
    return out


class WardrobeLibrary:
    def __init__(self, clothing: list[Clothing], backgrounds: list[Background]):
        self._clothing = clothing
        self._backgrounds = backgrounds
        self._c_by_key = {c.key: c for c in clothing}
        self._b_by_key = {b.key: b for b in backgrounds}

    @classmethod
    def load(cls) -> "WardrobeLibrary":
        return cls(_build_men() + _build_women(), _build_backgrounds())

    def clothing(self, gender: str) -> list[Clothing]:
        return [c for c in self._clothing if c.gender == gender]

    def backgrounds(self) -> list[Background]:
        return list(self._backgrounds)

    def categories(self, kind: str, gender: str = "male") -> list[str]:
        items = self.clothing(gender) if kind == "clothing" else self._backgrounds
        seen: list[str] = []
        for it in items:
            if it.category not in seen:
                seen.append(it.category)
        return seen

    def resolve(self, kind: str, keys: list[str], gender: str | None = None) -> list:
        """Позиции по ключам (в порядке запроса). Неизвестный ключ / чужой пол — ошибка."""
        by_key = self._c_by_key if kind == "clothing" else self._b_by_key
        unknown = [k for k in keys if k not in by_key]
        if unknown:
            raise ValueError(f"Неизвестные позиции ({kind}): {unknown}")
        items = [by_key[k] for k in keys]
        if kind == "clothing" and gender is not None:
            wrong = [c.key for c in items if c.gender != gender]
            if wrong:
                raise ValueError(f"Позиции не для пола {gender}: {wrong}")
        return items

    def get_clothing(self, key: str) -> Clothing:
        return self._c_by_key[key]

    def get_background(self, key: str) -> Background:
        return self._b_by_key[key]

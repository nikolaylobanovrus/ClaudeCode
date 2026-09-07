#!/usr/bin/env python3
"""Патч старого сайта nalog-service.online под тарифы и оферту раздела «под ключ».

Зачем скрипт, а не правка руками: исходников старого сайта нет, есть только
собранный Vue-бандл. Каждая замена ниже проверяется на «ровно одно
совпадение», поэтому если Beget-версия файла разойдётся с original/, патч
упадёт, а не молча пропустит правку.

Запуск:  python3 old-site/patch.py
Вход:    old-site/original/  (снято с nalog-service.online 07.09.2026)
Выход:   old-site/patched/   — то, что загружается в Файловый менеджер Beget
"""
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "original"
DST = ROOT / "patched"

PHONE = "+79208379193"
TG = f"https://t.me/{PHONE}"
MAX = "https://max.ru/u/f9LHodD0cOLIp0-KV0ruUarAhMwA5f5VEg7lElOPog3Zbi9MYv4py6G3TSA"
OFFER_DATE = "&laquo;07&raquo; сентября 2026 г."

# Иконка Max: у старого сайта нет такой картинки, а класть новый файл в img/ —
# лишний шаг при загрузке. SVG прямо в атрибуте src: фиолетовый круг, как
# кнопка Max на новом сайте.
MAX_ICON = (
    "data:image/svg+xml;utf8,"
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
    "<circle cx='32' cy='32' r='32' fill='%236c5ce7'/>"
    "<text x='32' y='40' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' "
    "font-weight='700' font-size='22' fill='%23fff'>MAX</text></svg>"
)


def sub(text, old, new, count=1, label=""):
    n = text.count(old)
    if n != count:
        sys.exit(f"ОШИБКА [{label}]: ожидалось {count} совпадений, найдено {n}: {old[:80]!r}")
    return text.replace(old, new)


def rsub(text, pattern, new, count=1, label=""):
    n = len(re.findall(pattern, text, re.S))
    if n != count:
        sys.exit(f"ОШИБКА [{label}]: ожидалось {count} совпадений regex, найдено {n}: {pattern[:80]!r}")
    return re.sub(pattern, new, text, flags=re.S)


# ---------------------------------------------------------------- index.html
def patch_index(t):
    # Мёртвый Google Analytics (Universal Analytics отключён в 2023).
    t = rsub(t, r'<script async src="https://www\.googletagmanager\.com/gtag/js\?id=UA-208621522-1"></script><script>.*?gtag\(\'config\', \'UA-208621522-1\'\);</script>',
             "", label="gtag")
    t = sub(t, "<html lang=en>", "<html lang=ru>", label="lang")
    # Три карточки тарифов одной высоты: цена и кнопка прижаты к низу, заголовок
    # с чипом «-10%» в одну строку (при трёх колонках он переносился).
    t = sub(t, "</style>",
            "#pricing .card.v-card{height:100%;display:flex;flex-direction:column}"
            "#pricing .card.v-card>p:last-child{margin-top:auto}"
            "#pricing .card h1{font-size:24px;white-space:nowrap}"
            "#pricing .card h1 .v-chip{margin:0 0 0 4px!important;height:26px;font-size:13px;padding:0 8px}"
            "#pricing .row{justify-content:center}"
            "</style>", label="pricing css")
    return t


# ------------------------------------------------------------ js/app.*.js
def patch_app(t):
    # 1. Три тарифа вместо двух. Сроки — как на новом сайте (3/2/1 рабочих дня).
    t = sub(t, 'subtitle: "Получите готовую декларацию 3-НДФЛ.",',
            'subtitle: "Получите готовую декларацию 3-НДФЛ. Срок — до 3 рабочих дней.",', count=2, label="basic subtitle")
    t = sub(t, 'subtitle: "Мы сделаем все за вас.",',
            'subtitle: "Мы сделаем все за вас. Срок — 1 рабочий день.",', count=2, label="premium subtitle")
    optimal = '''{
                            img: s("7a41"),
                            title: "Оптимальный",
                            titleChips: "-10%",
                            subtitle: "Самый популярный выбор. Срок — до 2 рабочих дней.",
                            description: "Декларация, заявление и консультация по подаче",
                            enabledOption: ["Гарантия качества услуг", "Декларация 3-НДФЛ", "Заявление на возврат налога", "Консультация по подаче в ФНС"],
                            disableOption: ["Подача документов в налоговую инспекцию"],
                            price: "1 210 ₽",
                            priceValue: "1210",
                            crossedPrice: "1 340 ₽",
                            rate: "Оптимальный (1 210 ₽)"
                        }, {
                            img: s("1f1e"),
                            title: "Премиум",'''
    t = sub(t, '''{
                            img: s("1f1e"),
                            title: "Премиум",''', optimal, count=2, label="optimal card")
    # Сетка карточек: три в ряд на широких экранах (lg+), две на средних (md), одна на телефоне.
    t = sub(t, '''                            xs: "6",
                            md: "6",
                            xl: "6"
                        }
                    }, [s("v-hover"''', '''                            xs: "6",
                            md: "6",
                            lg: "4",
                            xl: "4"
                        }
                    }, [s("v-hover"''', label="price grid")
    # Описание тарифа над формой заказа — по составу нового сайта.
    t = sub(t, 'return "Готовим для Вас декларацию 3-НДФЛ и заявление на возврат налога, а также иные документы в зависимости от Вашей ситуации";',
            'return "Готовим для Вас декларацию 3-НДФЛ и заявление на возврат налога, консультируем по подаче в налоговую";', label="optimal desc")

    # 2. Юрлицо в уведомлении о cookies.
    t = sub(t, "ООО «Налог-сервис» использует файлы cookie", "ООО «Информкарт» использует файлы cookie", label="cookie")

    # 3. Мессенджеры: только Telegram и Max, номер +7 920 837-91-93.
    t = rsub(t, r'panels: \[\{\s*href: "https://t\.me/\+79127916470",.*?text: "Написать в WhatsApp",\s*textStyle: "color: #0c893b"\s*\}\]',
             'panels: [{\n'
             f'                            href: "{TG}",\n'
             '                            img: s("a20f"),\n'
             '                            text: "Написать в Telegram",\n'
             '                            textStyle: "color: #095e82"\n'
             '                        }, {\n'
             f'                            href: "{MAX}",\n'
             f'                            img: "{MAX_ICON}",\n'
             '                            text: "Написать в Max",\n'
             '                            textStyle: "color: #6c5ce7"\n'
             '                        }]', label="messenger panels")
    t = rsub(t, r'a\("a", \{\s*staticClass: "d-inline-block pa-2",\s*attrs: \{\s*href: "https://wa\.me/79127916470"\s*\}\s*\}, \[a\("v-img", \{\s*attrs: \{\s*src: s\("36f2"\),\s*width: "50px",\s*title: "Написать в WhatsApp"\s*\}\s*\}\)\], 1\), ',
             "", label="contact wa icon")
    t = rsub(t, r', a\("a", \{\s*staticClass: "d-inline-block pa-2",\s*attrs: \{\s*href: "viber://chat\?number=%2B79127916470"\s*\}\s*\}, \[a\("v-img", \{\s*attrs: \{\s*src: s\("e10a"\),\s*width: "50px",\s*title: "Написать в Viber"\s*\}\s*\}\)\], 1\)',
             ', a("a", {\n'
             '                    staticClass: "d-inline-block pa-2",\n'
             '                    attrs: {\n'
             f'                        href: "{MAX}",\n'
             '                        target: "_blank"\n'
             '                    }\n'
             '                }, [a("v-img", {\n'
             '                    attrs: {\n'
             f'                        src: "{MAX_ICON}",\n'
             '                        width: "50px",\n'
             '                        title: "Написать в Max"\n'
             '                    }\n'
             '                })], 1)', label="contact viber icon -> max")
    t = sub(t, 'href: "https://t.me/+79127916470"\n', f'href: "{TG}"\n', label="contact tg icon")
    # Ссылки на мессенджеры внутри текстов FAQ (два вопроса).
    t = sub(t, '<a href="https://wa.me/79127916470" target="_blank">WhatsApp</a>, <a href="viber://chat?number=%2B79127916470" target="_blank">Viber</a> и <a href="https://t.me/+79127916470" target="_blank">Telegram</a>',
            f'<a href="{TG}" target="_blank">Telegram</a> и <a href="{MAX}" target="_blank">Max</a>', label="faq links 1")
    t = sub(t, '<a href="https://wa.me/79127916470" target="_blank">WhatsApp</a>, <a href="viber://chat?number=%2B79127916470">Viber</a> и <a href="https://t.me/+79127916470" target="_blank">Telegram</a>',
            f'<a href="{TG}" target="_blank">Telegram</a> и <a href="{MAX}" target="_blank">Max</a>', label="faq links 2")

    # 4. Срок в FAQ — по тарифам.
    t = sub(t, "Срок подготовки документов – в течение 3 рабочих дней с момента получения всех запрошенных документов.",
            "Срок подготовки документов – от 1 до 3 рабочих дней в зависимости от тарифа, с момента получения всех запрошенных документов.", label="faq term")

    for leftover in ("79127916470", "wa.me", "viber://"):
        if leftover in t:
            sys.exit(f"ОШИБКА: в бандле остался {leftover!r}")
    return t


# ---------------------------------------------------------------- offer.html
def row(name, term, price):
    cell = ('<td style="border-bottom:1px solid black; border-left:{left}; border-right:1px solid black; border-top:none; height:48px; width:{w}px">\n'
            '\t\t\t<p style="text-align:center"><span style="font-size:11pt"><span style="font-family:Calibri,&quot;sans-serif&quot;">{open}<span style="font-size:14.0pt"><span style="color:black">{txt}</span></span>{close}</span></span></p>\n'
            '\t\t\t</td>\n')
    return ("\t\t<tr>\n\t\t\t" + cell.format(left="1px solid black", w=235, open="<strong>", close="</strong>", txt=name)
            + "\t\t\t" + cell.format(left="none", w=172, open="", close="", txt=term)
            + "\t\t\t" + cell.format(left="none", w=257, open="", close="", txt=price)
            + "\t\t</tr>\n")


def patch_offer(t):
    t = sub(t, "&laquo;29&raquo; июля 2021 г.", OFFER_DATE, label="offer date")
    t = sub(t, "КПП 742001001", "КПП 741501001", label="kpp")
    t = sub(t, "Срок подготовки налоговой декларации по форме 3-НДФЛ составляет 5 (пять) рабочих дней при условии",
            "Срок подготовки налоговой декларации по форме 3-НДФЛ определяется выбранным Тарифом (Приложение №1) и составляет от 1 (одного) до 3 (трёх) рабочих дней при условии", label="term clause")
    t = sub(t, "мессенджера (WhatsApp, Telegram, Viber)", "мессенджера (Telegram, Max)", label="messengers")
    # Приложение №1: заменяем строки таблицы целиком.
    t = rsub(t, r"\t\t<tr>\n\t\t\t<td[^\n]*\n\t\t\t<p[^\n]*Базовый</span>.*?</tr>\n\t\t<tr>.*?1540 рублей</span>.*?</tr>\n",
             row("Базовый", "до 3 рабочих дней", "990 рублей")
             + row("Оптимальный", "до 2 рабочих дней", "1 210 рублей")
             + row("Премиум", "1 рабочий день", "1 540 рублей"), label="tariff table")
    return t


# --------------------------------------------------------------- policy.html
def patch_policy(t):
    return sub(t, "https://nalog-service.site/", "https://nalog-service.online/", label="policy site")


FILES = {
    "index.html": patch_index,
    "js/app.bc237cf3.js": patch_app,
    "offer.html": patch_offer,
    "policy.html": patch_policy,
}

if __name__ == "__main__":
    DST.mkdir(exist_ok=True)
    for rel, fn in FILES.items():
        src = (SRC / rel).read_text(encoding="utf-8")
        out = fn(src)
        dst = DST / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(out, encoding="utf-8")
        print(f"{rel}: {len(src)} → {len(out)} байт, sha256 {hashlib.sha256(out.encode()).hexdigest()[:16]}…")
    print("Готово:", DST)

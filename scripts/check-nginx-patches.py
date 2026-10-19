#!/usr/bin/env python3
"""Проверка правок nginx ДО выкладки: deploy/nginx.d/*.json.

    python3 scripts/check-nginx-patches.py

Сервер применяет эти файлы сам, без нашего участия (см. deploy/nginx.d/README.md),
поэтому единственное место, где ошибку ещё можно поймать, — здесь. Проверяем:

  • JSON читается и в нём есть все обязательные поля;
  • правка применима к эталонному конфигу (deploy/nginx-nalog-servis.conf):
    кусок `find` встречается ровно `expect` раз;
  • правка идемпотентна: после применения `done_marker` появляется, а
    повторный проход её пропускает;
  • в `replace` нет запрещённых директив — TLS, маршрутизация и соседний
    проект на том же сервере каналом не управляются.

Боевой файл отличается от эталонного (certbot дописал 443-й блок), поэтому
совпадение здесь не гарантирует применимость там — но расхождение здесь
гарантирует провал там, и это ловится за секунду вместо пяти минут.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PATCHES = ROOT / "deploy" / "nginx.d"
REFERENCE = ROOT / "deploy" / "nginx-nalog-servis.conf"

# Директивы, которых в правке быть не может. Список ровно про то, что канал
# НЕ должен уметь: сертификаты, проксирование, смена домена и портов,
# подключение чужих файлов, подмена корня.
FORBIDDEN = [
    "ssl_certificate", "proxy_pass", "fastcgi_pass", "server_name",
    "listen", "include", "alias", "root", "user ", "load_module",
]
REQUIRED = ("id", "why", "done_marker", "find", "expect", "replace")


def main() -> int:
    files = sorted(PATCHES.glob("*.json"))
    if not files:
        print("правок нет — канал пуст, это нормально")
        return 0
    conf = REFERENCE.read_text()
    problems = []

    for f in files:
        try:
            p = json.loads(f.read_text())
        except json.JSONDecodeError as e:
            problems.append(f"{f.name}: не читается как JSON — {e}")
            continue

        missing = [k for k in REQUIRED if k not in p]
        if missing:
            problems.append(f"{f.name}: нет полей {', '.join(missing)}")
            continue
        if p["id"] != f.stem:
            problems.append(f"{f.name}: id «{p['id']}» не совпадает с именем файла")

        bad = [d for d in FORBIDDEN if re.search(r"(?m)^\s*" + re.escape(d), p["replace"])]
        if bad:
            problems.append(f"{f.name}: запрещённые директивы — {', '.join(bad)}")

        if p["done_marker"] in conf:
            print(f"  · {f.name}: уже применена к эталону, пропуск")
            continue

        found = conf.count(p["find"])
        if found != p["expect"]:
            problems.append(
                f"{f.name}: кусок find встречается {found} раз, ожидалось {p['expect']}")
            continue

        conf = conf.replace(p["find"], p["replace"], p["expect"])
        if p["done_marker"] not in conf:
            problems.append(f"{f.name}: после замены нет done_marker — правка не идемпотентна")
            continue
        print(f"  ✓ {f.name}: применяется, done_marker на месте")

    # Грубая проверка синтаксиса: nginx тут не установлен, но перекос скобок
    # видно и так — а он кладёт конфиг целиком.
    if conf.count("{") != conf.count("}"):
        problems.append(f"после правок разъехались скобки: {conf.count('{')} «{{» против {conf.count('}')} «}}»")

    # Самое важное: прогоняем ТОТ САМЫЙ код, который выполнит сервер.
    # Проверка выше читает правки по-своему, а на боевой машине их применяет
    # python-вставка из deploy/nalog-servis-pull.sh. Если они разойдутся,
    # выкладка либо не применит правку, либо применит не так — и узнаем мы
    # об этом по сломанному сайту, а не здесь.
    problems += run_server_applier()

    if problems:
        print("\nПРОБЛЕМЫ:\n  " + "\n  ".join(problems), file=sys.stderr)
        return 1
    print(f"Правки nginx в порядке: {len(files)} шт.")
    return 0


# Боевой конфиг отличается от эталонного: certbot дописал в него 443-й блок с
# путями к сертификатам. Подделываем это отличие, чтобы правка проверялась в
# условиях, похожих на боевые, а не на чистом файле из репозитория.
CERTBOT_TAIL = """
server {
    listen 443 ssl;
    server_name xn----7sbhcltqolxje.xn--p1ai;
    ssl_certificate /etc/letsencrypt/live/xn----7sbhcltqolxje.xn--p1ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xn----7sbhcltqolxje.xn--p1ai/privkey.pem;
    root /var/www/nalog-servis;
}
"""


def run_server_applier():
    """Выполнить вставку из nalog-servis-pull.sh на копии «боевого» конфига."""
    import subprocess
    import tempfile

    pull = (ROOT / "deploy" / "nalog-servis-pull.sh").read_text()
    # Первая python-вставка в скрипте — применятель правок (вторая пишет
    # deploy-status.json). Берём ровно её.
    try:
        body = pull.split("<<'PY'\n", 1)[1].split("\nPY\n", 1)[0]
    except IndexError:
        return ["в deploy/nalog-servis-pull.sh не найдена python-вставка применятеля"]

    out = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        conf = tmp / "nalog-servis"
        conf.write_text(REFERENCE.read_text() + CERTBOT_TAIL)
        applier = tmp / "applier.py"
        applier.write_text(body)
        result_file = tmp / "out.conf"

        def run():
            return subprocess.run(
                [sys.executable, str(applier), str(conf), str(PATCHES), str(result_file)],
                capture_output=True, text=True)

        r = run()
        if r.returncode != 0:
            return [f"применятель с сервера отказался: {r.stdout.strip()} {r.stderr.strip()}"]
        if "APPLY " not in r.stdout:
            out.append("применятель с сервера: все правки уже стоят в эталоне — нечего проверять")
            return []
        applied = result_file.read_text()
        for marker in ("ssl_certificate", "listen 443"):
            if marker not in applied:
                return [f"применятель потерял блок certbot ({marker}) — правка снесла бы TLS"]

        # Второй проход по уже поправленному файлу обязан не найти работы:
        # таймер запускает выкладку каждые пять минут, и неидемпотентная
        # правка размножилась бы в конфиге 288 раз в сутки.
        conf.write_text(applied)
        r2 = run()
        if r2.returncode != 0:
            return [f"повторный проход упал: {r2.stdout.strip()} {r2.stderr.strip()}"]
        if "APPLY " in r2.stdout:
            return ["повторный проход снова применяет правки — они не идемпотентны"]
        if "SKIP " not in r2.stdout:
            return ["повторный проход не сообщил, что правки уже стоят — в статусе будет «правок нет»"]
        print("  ✓ применятель с сервера: правки встали, TLS на месте, повтор ничего не делает")
    return guards_hold(body)


# Канал обязан быть узким не на словах. Подсовываем применятелю заведомо
# плохие правки и требуем отказа: иначе однажды «найти и заменить» окажется
# способом увести боевой домен куда угодно.
def guards_hold(applier_body):
    import subprocess
    import tempfile

    conf_src = REFERENCE.read_text()
    cases = {
        "запрещённая директива": {
            "find": "    gzip on;\n",
            "replace": "    gzip on;\n    proxy_pass http://chuzhoy.example;\n    # ZZZ\n"},
        "кусок find не найден": {
            "find": "такой строки в конфиге нет\n", "replace": "ZZZ\n"},
        "find встречается не столько раз": {
            "find": "    gzip on;\n", "replace": "    gzip on; # ZZZ\n", "expect": 2},
        "после замены нет done_marker": {
            "find": "    gzip on;\n", "replace": "    gzip on;\n"},
    }
    problems = []
    for name, extra in cases.items():
        patch = {"id": "010-proba", "why": "проверка защиты", "done_marker": "ZZZ", "expect": 1}
        patch.update(extra)
        with tempfile.TemporaryDirectory() as tmp:
            tmp = pathlib.Path(tmp)
            (tmp / "conf").write_text(conf_src)
            (tmp / "patches").mkdir()
            (tmp / "patches" / "010-proba.json").write_text(json.dumps(patch, ensure_ascii=False))
            (tmp / "applier.py").write_text(applier_body)
            r = subprocess.run(
                [sys.executable, str(tmp / "applier.py"), str(tmp / "conf"),
                 str(tmp / "patches"), str(tmp / "out.conf")],
                capture_output=True, text=True)
            if r.returncode == 0 or (tmp / "out.conf").exists():  # плохая правка обязана остановить применятель
                problems.append(f"применятель НЕ отказался от плохой правки «{name}»")
    if not problems:
        print(f"  ✓ защита держит: применятель отказался от всех {len(cases)} плохих правок")
    return problems


if __name__ == "__main__":
    sys.exit(main())

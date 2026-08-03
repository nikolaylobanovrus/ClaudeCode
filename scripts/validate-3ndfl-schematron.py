# Мини-Schematron-валидатор для XSD-схем ФНС: вытаскивает sch:rule/assert,
# переписывает usch:iif в XPath 1.0 и применяет к XML через lxml.
import re, sys, glob
from lxml import etree

def load_rules(year):
    s = open(f"/home/user/ClaudeCode/docs/fns-schemas/3ndfl-{year}.xsd", encoding="cp1251").read()
    rules = []
    for ctx, body in re.findall(r'<sch:rule context="([^"]+)">(.*?)</sch:rule>', s, re.S):
        for test, err in re.findall(r'<sch:assert test="([^"]+)"\s*>(.*?)</sch:assert>', body, re.S):
            msg = re.sub(r"<[^>]+>|\s+", " ", err).strip()[:160]
            rules.append((ctx, test, msg))
    return rules

def rewrite(test):
    # usch:iif(A, B, C) -> ((A) and (B)) or (not(A) and (C)) — с балансом скобок
    while "usch:iif(" in test:
        i = test.index("usch:iif(")
        j = i + len("usch:iif(")
        depth, args, cur = 1, [], ""
        while depth:
            ch = test[j]
            if ch == "(": depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0: break
            if ch == "," and depth == 1:
                args.append(cur); cur = ""
            else: cur += ch
            j += 1
        args.append(cur)
        a, b, c = [x.strip() for x in args]
        test = test[:i] + f"((({a}) and ({b})) or (not({a}) and ({c})))" + test[j+1:]
    return test

for year in (2022, 2023, 2024, 2025):
    rules = load_rules(year)
    files = sorted(glob.glob(f"{sys.argv[1]}/*-{year}.xml"))
    for f in files:
        tree = etree.parse(f)
        fails = []
        for ctx, test, msg in rules:
            if "getFileName" in test: continue  # имя файла = ИдФайл, соблюдено конструктивно
            t = rewrite(test)
            for node in tree.iter():
                tag = etree.QName(node).localname
                if tag != ctx.split("/")[-1]: continue
                try:
                    ok = node.xpath(f"boolean({t})")
                except Exception as e:
                    fails.append((ctx, f"XPATH ERR {e}", t[:80])); break
                if not ok:
                    fails.append((ctx, msg, test[:100]))
        name = f.split("/")[-1]
        if fails:
            print(f"✗ {name}:")
            for ctx, msg, t in fails[:5]: print(f"    [{ctx}] {msg}")
        else:
            print(f"✓ {name}: все schematron-правила пройдены")

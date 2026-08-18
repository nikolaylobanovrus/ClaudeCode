#!/usr/bin/env python3
"""Выкладка собранного сайта (dist/) в S3-совместимое хранилище.

Зачем: GitHub Pages отдаёт сайт с адресов 185.199.108–111.153, и часть
российских операторов их фильтрует — 18.08.2026 до сайта доезжала треть
оплаченного трафика (через мобильный интернет открывалось, через
проводного провайдера — таймаут). Хостинг переезжает на российское
объектное хранилище; скрипт один и тот же для Яндекс Облака, Timeweb и
VK Cloud — все они говорят на S3.

Ключи читаются из /root/.ndfl-tokens (в репозиторий не попадают):
    S3_ENDPOINT=https://storage.yandexcloud.net
    S3_BUCKET=nalog-servis
    S3_KEY_ID=...
    S3_SECRET=...

Запуск:  VITE_HASH_ROUTER=1 npm run build && python3 scripts/deploy-static.py
"""
import hashlib
import mimetypes
import os
import re
import sys

import boto3

TOKENS = "/root/.ndfl-tokens"
DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")

# index.html и служебные файлы не кэшируем: иначе после выкладки люди сутками
# видят старую версию. Файлы из assets/ содержат хеш в имени — их можно
# кэшировать вечно.
NO_CACHE = {"index.html", "robots.txt", "sitemap.xml", "llms.txt", "_redirects"}
IMMUTABLE = "public, max-age=31536000, immutable"
FRESH = "no-cache, must-revalidate"


def env():
    if not os.path.exists(TOKENS):
        sys.exit(f"нет файла {TOKENS}")
    text = open(TOKENS).read()
    conf = {}
    for key in ("S3_ENDPOINT", "S3_BUCKET", "S3_KEY_ID", "S3_SECRET"):
        m = re.search(rf"(?<=^{key}=).*", text, re.M)
        if not m:
            sys.exit(f"в {TOKENS} нет {key} — см. docs/hosting-migration.md")
        conf[key] = m.group(0).strip()
    return conf


def main():
    if not os.path.isdir(DIST):
        sys.exit("нет dist/ — сначала VITE_HASH_ROUTER=1 npm run build")
    c = env()
    s3 = boto3.client(
        "s3",
        endpoint_url=c["S3_ENDPOINT"],
        aws_access_key_id=c["S3_KEY_ID"],
        aws_secret_access_key=c["S3_SECRET"],
        region_name="ru-central1",
    )

    # Что уже лежит в бакете — заливаем только изменившееся (ETag = md5).
    remote = {}
    token = None
    while True:
        kw = {"Bucket": c["S3_BUCKET"]}
        if token:
            kw["ContinuationToken"] = token
        page = s3.list_objects_v2(**kw)
        for o in page.get("Contents", []):
            remote[o["Key"]] = o["ETag"].strip('"')
        if not page.get("IsTruncated"):
            break
        token = page.get("NextContinuationToken")

    sent = skipped = 0
    local = set()
    for root, _, files in os.walk(DIST):
        for name in files:
            path = os.path.join(root, name)
            key = os.path.relpath(path, DIST).replace(os.sep, "/")
            local.add(key)
            body = open(path, "rb").read()
            md5 = hashlib.md5(body).hexdigest()
            if remote.get(key) == md5:
                skipped += 1
                continue
            ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
                ctype += "; charset=utf-8"
            s3.put_object(
                Bucket=c["S3_BUCKET"], Key=key, Body=body, ContentType=ctype,
                CacheControl=FRESH if name in NO_CACHE else IMMUTABLE,
            )
            sent += 1
            print("  ↑", key)

    # Старые ассеты с чужими хешами убираем, чтобы бакет не пух.
    stale = [k for k in remote if k not in local]
    for i in range(0, len(stale), 1000):
        chunk = stale[i:i + 1000]
        s3.delete_objects(Bucket=c["S3_BUCKET"], Delete={"Objects": [{"Key": k} for k in chunk]})
    print(f"залито {sent}, без изменений {skipped}, удалено устаревших {len(stale)}")


if __name__ == "__main__":
    main()

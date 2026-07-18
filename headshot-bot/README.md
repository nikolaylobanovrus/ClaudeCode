# Headshot Bot — AI-деловые портреты в Telegram

MVP по плану: Flux LoRA на fal.ai, разовая оплата, автоудаление данных через 30 дней.

## Запуск

```bash
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
cp .env.example .env   # заполнить BOT_TOKEN (обязательно), FAL_KEY (PROVIDER=fal)
set -a; source .env; set +a
./venv/bin/python -m bot.main
```

Без FAL_KEY работает на FakeProvider (PROVIDER=fake): весь поток проходит,
вместо портретов — цветные заглушки. Оплата в режиме MANUAL_PAYMENT=true
подтверждается администратором командой /approve_<job_id> (ADMIN_TG_IDS).

## Тесты

```bash
./venv/bin/python -m pytest tests/ -q
```

## Структура

- `bot/` — aiogram-хендлеры: онбординг, согласие (152-ФЗ), загрузка фото, тизер, пакеты, доставка
- `core/` — state machine заказа, пакеты, валидация фото, модели БД
- `providers/` — абстракция генерации: FalFluxProvider (прод) / FakeProvider (dev)
- `prompts/styles.yaml` — библиотека деловых стилей
- `worker.py` — конвейер training → generating → delivering с ретраями
- `providers/quality.py` — конвейер качества: CodeFormer-реставрация лиц и
  vision-QC с перегенерацией брака (флаги `QUALITY_ENHANCE`, `QUALITY_QC`)
- `web/` — FastAPI: лендинг + API каталога

## Дорожная карта

1. ✅ Каркас бота, оплата вручную, выбор образов, конвейер качества (за флагами)
2. Первая реальная фотосессия на fal.ai → тюнинг промптов и включение QC
3. Vision-валидация загрузок (LLaVa/Qwen-VL) вместо эвристик
4. Каталог фон×наряд с превью (веб, два экрана как у HeadshotPro)
5. ЮKassa + деплой на VPS (домен, HTTPS, мониторинг)
6. Страница-приманка «бесплатный деловой портрет» (SEO-лидоген)

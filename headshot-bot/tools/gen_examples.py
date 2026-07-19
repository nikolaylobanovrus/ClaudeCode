"""CLI генерации примеров для лендинга.

  gen_examples.py --slot studio_grey --variant a --seed 11 [--model ultra|dev|kontext]
                  [--source /path/before.jpg] [--extra-file /tmp/extra.txt]

Промпт берётся из tools/slots.json (singles или pairs) + общий realism-хвост;
--extra-file добавляет уточнения из критики судьи. Результат: /tmp/gen/<slot>_<variant>.jpg
Печатает JSON {"file": "...", "bytes": N}.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = Path("/tmp/gen")


def load_env() -> None:
    for line in (ROOT / ".env").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


async def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--slot", required=True)
    p.add_argument("--variant", default="a")
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--model", default="ultra", choices=["ultra", "dev", "kontext"])
    p.add_argument("--source", help="исходное фото для kontext")
    p.add_argument("--extra-file", help="файл с добавками к промпту от судьи")
    a = p.parse_args()

    load_env()
    import aiohttp
    import fal_client

    cfg = json.loads((ROOT / "tools/slots.json").read_text(encoding="utf-8"))
    prompt = cfg["singles"].get(a.slot) or cfg["pairs"].get(a.slot)
    if not prompt:
        raise SystemExit(f"неизвестный слот: {a.slot}")
    if a.slot in cfg["singles"]:
        prompt += cfg["_realism_tail"]
    if a.extra_file and Path(a.extra_file).exists():
        prompt += ", " + Path(a.extra_file).read_text(encoding="utf-8").strip()

    if a.model == "ultra":
        endpoint = "fal-ai/flux-pro/v1.1-ultra"
        args = {"prompt": prompt, "aspect_ratio": "3:4", "raw": True,
                "seed": a.seed, "output_format": "jpeg"}
    elif a.model == "dev":
        endpoint = "fal-ai/flux/dev"
        args = {"prompt": prompt, "image_size": "portrait_4_3",
                "num_inference_steps": 40, "guidance_scale": 3.5, "seed": a.seed}
    else:  # kontext
        if not a.source:
            raise SystemExit("kontext требует --source")
        url = await fal_client.upload_async(Path(a.source).read_bytes(), "image/jpeg")
        endpoint = "fal-ai/flux-pro/kontext"
        args = {"prompt": prompt, "image_url": url, "output_format": "jpeg", "seed": a.seed}

    result = await fal_client.run_async(endpoint, arguments=args)
    img_url = result["images"][0]["url"]
    async with aiohttp.ClientSession() as s:
        async with s.get(img_url) as resp:
            data = await resp.read()

    OUT_DIR.mkdir(exist_ok=True)
    out = OUT_DIR / f"{a.slot}_{a.variant}.jpg"
    out.write_bytes(data)
    print(json.dumps({"file": str(out), "bytes": len(data)}))


if __name__ == "__main__":
    asyncio.run(main())

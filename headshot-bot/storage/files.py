"""Хранилище файлов: локальный диск сейчас, тот же интерфейс для S3 позже.

Ключи имеют вид "jobs/{job_id}/{kind}/{name}". Автоудаление по TTL
реализует политику хранения (152-ФЗ): исходные фото и веса живут
retention_days, после чего стираются вместе с записями.
"""
import shutil
import time
from pathlib import Path


class FileStorage:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root.resolve()):
            raise ValueError(f"Недопустимый ключ: {key!r}")
        return path

    def put(self, key: str, data: bytes) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def get(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._path(key).exists()

    def delete_job(self, job_id: int) -> None:
        shutil.rmtree(self.root / f"jobs/{job_id}", ignore_errors=True)

    def purge_older_than(self, max_age_seconds: float) -> list[int]:
        """Удаляет каталоги заказов старше max_age_seconds. Возвращает job_id."""
        purged: list[int] = []
        jobs_dir = self.root / "jobs"
        if not jobs_dir.exists():
            return purged
        cutoff = time.time() - max_age_seconds
        for job_dir in jobs_dir.iterdir():
            if job_dir.is_dir() and job_dir.stat().st_mtime < cutoff:
                shutil.rmtree(job_dir, ignore_errors=True)
                try:
                    purged.append(int(job_dir.name))
                except ValueError:
                    pass
        return purged

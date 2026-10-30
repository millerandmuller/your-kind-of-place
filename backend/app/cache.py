"""Private request-hash cache for upstream answers. Lives on the server only, never in the repo."""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any


def request_hash(path: str, params: dict[str, Any]) -> str:
    canonical = json.dumps([path, sorted(params.items())], separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


class FileCache:
    def __init__(self, directory: Path, max_files: int = 600):
        self.directory = directory
        self.max_files = max_files
        self._writes = 0

    def _file(self, key: str) -> Path:
        return self.directory / key[:2] / f"{key}.json"

    def get(self, key: str) -> tuple[Any, float] | None:
        """Return (payload, age_seconds) or None."""
        path = self._file(key)
        try:
            blob = json.loads(path.read_text())
            return blob["payload"], max(0.0, time.time() - float(blob["stored_at"]))
        except (OSError, ValueError, KeyError, TypeError):
            return None  # a damaged entry is a miss, never an error

    def set(self, key: str, payload: Any) -> None:
        path = self._file(key)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps({"stored_at": time.time(), "payload": payload}))
            tmp.replace(path)
            self._writes += 1
            if self._writes % 25 == 0:
                self._prune()
        except OSError:
            pass  # a cache write must never break a request

    def _prune(self) -> None:
        """Keep the newest `max_files` entries (the cache lives in memory on Cloud Run)."""
        try:
            files = [f for f in self.directory.glob("*/*.json") if not f.parent.name.startswith("_")]
            if len(files) <= self.max_files:
                return
            files.sort(key=lambda f: f.stat().st_mtime)
            for old in files[: len(files) - self.max_files]:
                old.unlink(missing_ok=True)
        except OSError:
            pass

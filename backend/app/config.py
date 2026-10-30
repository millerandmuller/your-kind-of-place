"""Single place for environment-driven settings (provider, model, cache, limits)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parents[2]


def _load_env() -> None:
    # Local convenience: nearest .env walking up from the repo; never committed.
    for parent in [_ROOT, *_ROOT.parents]:
        candidate = parent / ".env"
        if candidate.is_file():
            load_dotenv(candidate, override=False)
            return


_load_env()


@dataclass(frozen=True)
class Settings:
    qloo_api_key: str
    qloo_base_url: str
    cache_dir: Path
    cache_fresh_seconds: int
    window: int  # length of the hotel's default list
    take: int  # Qloo insights page size (max 50)
    rate_limit_per_minute: int
    llm_provider: str  # gemini | anthropic | none
    llm_model: str
    llm_fallback_model: str
    gemini_api_key: str
    anthropic_api_key: str


def _pick_provider() -> tuple[str, str, str]:
    gemini = os.getenv("GEMINI_API_KEY", "")
    anthropic = os.getenv("ANTHROPIC_API_KEY", "")
    forced = os.getenv("LLM_PROVIDER", "").lower()
    provider = forced or ("anthropic" if anthropic else "gemini" if gemini else "none")
    defaults = {
        "gemini": ("gemini-3.7-flash", "gemini-2.5-flash"),
        "anthropic": ("claude-haiku-5-5", "claude-sonnet-5-5"),
        "none": ("", ""),
    }
    model, fallback = defaults.get(provider, ("", ""))
    return provider, os.getenv("LLM_MODEL", model), os.getenv("LLM_FALLBACK_MODEL", fallback)


def load_settings() -> Settings:
    provider, model, fallback = _pick_provider()
    cache_dir = Path(os.getenv("QLOO_CACHE_DIR", ".cache/qloo"))
    if not cache_dir.is_absolute():
        cache_dir = _ROOT / cache_dir
    return Settings(
        qloo_api_key=os.getenv("QLOO_API_KEY", ""),
        qloo_base_url=os.getenv("QLOO_BASE_URL", "https://hackathon.api.qloo.com").rstrip("/"),
        cache_dir=cache_dir,
        cache_fresh_seconds=int(os.getenv("CACHE_FRESH_SECONDS", str(6 * 3600))),
        window=int(os.getenv("LIST_LENGTH", "10")),
        take=min(int(os.getenv("QLOO_TAKE", "50")), 50),
        rate_limit_per_minute=int(os.getenv("RATE_LIMIT_PER_MINUTE", "30")),
        llm_provider=provider,
        llm_model=model,
        llm_fallback_model=fallback,
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
    )

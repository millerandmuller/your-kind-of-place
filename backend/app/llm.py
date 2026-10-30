"""One thin gateway for every LLM call. Provider, model and fallback live in config only.

If no provider is configured every caller degrades to its deterministic path and says so.
"""
from __future__ import annotations

import json
import re
from typing import Any

import httpx

from .config import Settings


class LlmUnavailable(RuntimeError):
    pass


def _extract_json(text: str) -> Any:
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fenced:
        text = fenced.group(1).strip()
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=-1)
    if start > 0:
        text = text[start:]
    return json.loads(text)


class LlmGateway:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None):
        self.settings = settings
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(40.0, connect=5.0), transport=transport)

    @property
    def available(self) -> bool:
        return self.settings.llm_provider != "none" and bool(self.settings.llm_model)

    @property
    def label(self) -> str:
        return f"{self.settings.llm_provider}:{self.settings.llm_model}" if self.available else "none"

    async def aclose(self) -> None:
        await self._http.aclose()

    async def complete(self, system: str, prompt: str, *, max_tokens: int = 1200) -> str:
        if not self.available:
            raise LlmUnavailable("no LLM provider configured")
        last: Exception | None = None
        for model in [self.settings.llm_model, self.settings.llm_fallback_model]:
            if not model:
                continue
            try:
                return await self._call(model, system, prompt, max_tokens)
            except Exception as exc:  # noqa: BLE001 — try the fallback model, then surface
                last = exc
        raise LlmUnavailable(f"LLM call failed: {last}")

    async def complete_json(self, system: str, prompt: str, *, max_tokens: int = 1200) -> Any:
        raw = await self.complete(system, prompt, max_tokens=max_tokens)
        try:
            return _extract_json(raw)
        except ValueError as exc:
            raise LlmUnavailable(f"LLM returned invalid JSON: {exc}") from exc

    async def _call(self, model: str, system: str, prompt: str, max_tokens: int) -> str:
        s = self.settings
        if s.llm_provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            body = {
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.2},
            }
            resp = await self._http.post(url, json=body, headers={"x-goog-api-key": s.gemini_api_key})
            resp.raise_for_status()
            parts = resp.json()["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts)
        if s.llm_provider == "anthropic":
            resp = await self._http.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": s.anthropic_api_key, "anthropic-version": "2023-06-01"},
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "system": system,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            if resp.status_code >= 400:
                raise LlmUnavailable(f"{resp.status_code} {resp.text[:200]}")
            return "".join(b.get("text", "") for b in resp.json()["content"])
        raise LlmUnavailable(f"unknown provider {s.llm_provider}")

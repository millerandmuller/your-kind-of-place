"""Thin async Qloo client: /search and /v2/insights for places.

Live first; fresh cache entries skip the network; if live fails the stale cache answers and the
request is flagged `cached` so the UI can say so. Never falls back silently to anything else.
"""
from __future__ import annotations

import asyncio
import contextvars
from dataclasses import dataclass, field
from typing import Any

import httpx

from .cache import FileCache, request_hash
from .config import Settings

PLACE = "urn:entity:place"
# What a guest can name as a favourite. Order = search order when the type is unknown.
INTEREST_TYPES = (
    "urn:entity:artist",
    "urn:entity:tv_show",
    "urn:entity:movie",
    "urn:entity:brand",
    "urn:entity:videogame",
)
DINING_TAG = "urn:tag:genre:place:restaurant"
# Categories that passed the blind test (11/12 dining, 10/12 nightlife); others are not offered.
CATEGORY_TAGS = {
    "dining": DINING_TAG,
    "nightlife": "urn:tag:genre:place:live_music_venue,urn:tag:genre:place:night_club",
}


def _genre_id(value: Any) -> str:
    return (value or {}).get("id", "") if isinstance(value, dict) else str(value or "")


def _trim_entity(e: dict[str, Any]) -> dict[str, Any]:
    """Keep only what the product reads; Qloo's full entity payloads are ~10x larger."""
    props = e.get("properties") or {}
    keep = {
        k: props.get(k)
        for k in ("neighborhood", "address", "short_description", "price_level", "description")
        if props.get(k) is not None
    }
    if isinstance(keep.get("description"), str):
        keep["description"] = keep["description"][:300]
    if props.get("primary_genre"):
        keep["primary_genre"] = _genre_id(props["primary_genre"])
    if props.get("akas"):
        keep["akas"] = [a for a in props["akas"] if isinstance(a, dict)][:12]
    out = {k: e.get(k) for k in ("name", "entity_id", "popularity", "types", "subtype") if k in e}
    out["properties"] = keep
    loc = e.get("location") or {}
    if "lat" in loc and "lon" in loc:
        out["location"] = {"lat": loc["lat"], "lon": loc["lon"]}
    if "query" in e:
        q = e.get("query") or {}
        out["query"] = {"affinity": q.get("affinity"), "explainability": q.get("explainability")}
    if e.get("tags"):
        out["tags"] = [
            {"name": t.get("name"), "type": t.get("type")}
            for t in e["tags"][:40]
            if isinstance(t, dict) and str(t.get("type", "")).startswith("urn:tag:genre:place")
        ]
    return out


def shape_entities(data: dict[str, Any]) -> dict[str, Any]:
    if isinstance(data.get("results"), dict):
        ents = data["results"].get("entities")
        if isinstance(ents, list):
            return {"results": {"entities": [_trim_entity(e) for e in ents]}}
    if isinstance(data.get("results"), list):
        return {"results": [_trim_entity(e) for e in data["results"]]}
    return data


class QlooError(RuntimeError):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


@dataclass
class Trace:
    """Per-request bookkeeping: did any answer come from the cache, how many live calls."""

    cached: bool = False
    cache_age_seconds: float = 0.0
    live_calls: int = 0
    notes: list[str] = field(default_factory=list)


_trace: contextvars.ContextVar[Trace | None] = contextvars.ContextVar("qloo_trace", default=None)


def start_trace() -> Trace:
    trace = Trace()
    _trace.set(trace)
    return trace


class QlooClient:
    def __init__(self, settings: Settings, cache: FileCache, transport: httpx.AsyncBaseTransport | None = None):
        self.settings = settings
        self.cache = cache
        self._client = httpx.AsyncClient(
            base_url=settings.qloo_base_url,
            headers={"X-Api-Key": settings.qloo_api_key, "User-Agent": "your-kind-of-place/1.0"},
            timeout=httpx.Timeout(20.0, connect=4.0),  # New York place queries take ~9-10 s
            transport=transport,
        )
        self._gate = asyncio.Semaphore(4)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _live(self, path: str, params: dict[str, Any]) -> Any:
        last: Exception | None = None
        attempts = 2  # retry only fast failures (429/5xx); a timeout is not retried, so a call stays ≤ ~20 s
        for attempt in range(attempts):
            try:
                async with self._gate:
                    resp = await self._client.get(path, params=params)
            except httpx.TimeoutException as exc:
                raise QlooError(f"Qloo timed out: {exc.__class__.__name__}") from exc
            except httpx.HTTPError as exc:
                last = QlooError(f"Qloo unreachable: {exc.__class__.__name__}")
            else:
                if resp.status_code == 200:
                    return resp.json()
                if resp.status_code in (429, 500, 502, 503, 504):
                    last = QlooError(f"Qloo returned {resp.status_code}", resp.status_code)
                else:  # 4xx other than 429 won't improve with a retry
                    raise QlooError(f"Qloo returned {resp.status_code}", resp.status_code)
            if attempt < attempts - 1:
                await asyncio.sleep(0.4 * (2**attempt))
        raise last or QlooError("Qloo request failed")

    async def get(self, path: str, params: dict[str, Any], shape=None) -> Any:
        trace = _trace.get()
        key = request_hash(path, params)
        hit = self.cache.get(key)
        if hit is not None and hit[1] <= self.settings.cache_fresh_seconds:
            self._note(trace, hit[1])
            return hit[0]
        try:
            data = await self._live(path, params)
        except QlooError:
            if hit is None:
                raise
            self._note(trace, hit[1])
            if trace:
                trace.notes.append("live Qloo unavailable — answered from cache")
            return hit[0]
        if trace:
            trace.live_calls += 1
        if shape is not None:
            data = shape(data)
        self.cache.set(key, data)
        return data

    @staticmethod
    def _note(trace: Trace | None, age: float) -> None:
        if trace:
            trace.cached = True
            trace.cache_age_seconds = max(trace.cache_age_seconds, age)

    # --- endpoints -------------------------------------------------------------------------

    async def affinity(self, place_ids: list[str], interest_ids: list[str]) -> dict[str, float]:
        """The guest's taste affinity for exactly these places (Insights restricted to their ids).

        Empty when Qloo can't answer: the edit then falls back to list order, it never guesses.
        """
        params = {
            "filter.type": PLACE,
            "filter.results.entities": ",".join(place_ids[:50]),
            "signal.interests.entities": ",".join(interest_ids),
            "take": min(len(place_ids), 50),
        }
        try:
            data = await self.get("/v2/insights", params, shape_entities)
        except QlooError:
            return {}
        out = {}
        for e in data.get("results", {}).get("entities", []):
            a = (e.get("query") or {}).get("affinity")
            if e.get("entity_id") and isinstance(a, (int, float)):
                out[e["entity_id"]] = float(a)
        return out

    async def search(self, query: str, entity_type: str, limit: int = 5) -> list[dict[str, Any]]:
        """`entity_type` may be a comma-separated list of types."""
        wanted = set(entity_type.split(","))
        data = await self.get("/search", {"query": query, "types": entity_type, "limit": limit}, shape_entities)
        return [r for r in data.get("results", []) if wanted & set(r.get("types") or wanted)]

    async def places(
        self,
        city: str,
        interest_ids: list[str] | None = None,
        *,
        take: int = 50,
        explain: bool = False,
        category: str = "dining",
    ) -> list[dict[str, Any]]:
        """Places of one category in a city, ranked by Qloo. Without interests: the city's default ranking."""
        params: dict[str, Any] = {
            "filter.type": PLACE,
            "filter.location.query": city,
            "filter.tags": CATEGORY_TAGS[category],
            "take": min(take, 50),
        }
        if interest_ids:
            params["signal.interests.entities"] = ",".join(interest_ids)
            if explain:
                params["feature.explainability"] = "true"
        data = await self.get("/v2/insights", params, shape_entities)
        return data.get("results", {}).get("entities", [])

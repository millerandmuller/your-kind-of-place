"""One service behind the HTTP API, the agent and the MCP tool: same inputs, same redline."""
from __future__ import annotations

import asyncio
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import redline as rl
from .qloo import QlooClient, start_trace
from .resolve import Clarify, Entity, NotFound, resolve_interest

CITIES = ("London", "San Francisco", "New York", "Austin", "Berlin")
# What Qloo is asked for: plain "New York" also matches places across New York State.
CITY_QUERY = {"New York": "New York City"}
# City centres (lat, lon); anything farther than MAX_KM is not a place a concierge sends a guest to.
CENTRES = {
    "London": (51.5072, -0.1276),
    "San Francisco": (37.7749, -122.4194),
    "New York": (40.7128, -74.0060),
    "Austin": (30.2672, -97.7431),
    "Berlin": (52.5200, 13.4050),
}
MAX_KM = 25
DEMO_FILE = Path(__file__).resolve().parents[2] / "demo-data" / "demo_guests.json"
MAX_INTERESTS = 3
# A saved answer younger than this is just the same visit; older ones are labelled "cached result".
CACHED_LABEL_AFTER_S = 600


@dataclass
class InterestIn:
    name: str
    id: str | None = None


class UnknownCity(ValueError):
    pass


def check_city(city: str) -> str:
    for c in CITIES:
        if c.lower() == city.strip().lower():
            return c
    raise UnknownCity(f"Pick one of: {', '.join(CITIES)}")


def km_from_centre(city: str, place: dict[str, Any]) -> float | None:
    loc = place.get("location") or {}
    if "lat" not in loc or "lon" not in loc:
        return None
    lat1, lon1 = map(math.radians, CENTRES[city])
    lat2, lon2 = math.radians(loc["lat"]), math.radians(loc["lon"])
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def in_town(city: str, places: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Places within MAX_KM of the city centre; places without coordinates are dropped too."""
    return [p for p in places if (d := km_from_centre(city, p)) is not None and d <= MAX_KM]


def load_demo() -> dict[str, Any]:
    try:
        return json.loads(DEMO_FILE.read_text())
    except (OSError, ValueError):
        return {"pairs": []}


def cached_label(result: dict[str, Any]) -> bool:
    """'cached result' = live Qloo failed and a saved answer stood in, or nothing in this version
    was fetched live and the saved answers are older than this visit. A new guest whose taste query
    ran live is never labelled, even if the city's default list came from the cache."""
    if result.get("fallback"):
        return True
    return (
        bool(result.get("cached"))
        and result.get("live_calls", 0) == 0
        and result.get("cache_age_seconds", 0) >= CACHED_LABEL_AFTER_S
    )


class Redliner:
    def __init__(self, qloo: QlooClient, length: int = 10):
        self.qloo = qloo
        self.length = length

    async def default_list(self, city: str) -> list[dict[str, Any]]:
        """The city's top dining places with no taste signal: the stand-in for the hotel's list."""
        city = check_city(city)
        places = await self.qloo.places(CITY_QUERY.get(city, city), take=50)
        return in_town(city, rl.dining(places))[: self.length]

    async def taste_places(self, city: str, ids: list[str]) -> tuple[list[dict[str, Any]], set[str]]:
        """The guest's top 50 Qloo matches: (dining places in rank order, ids of all 50)."""
        city = check_city(city)
        raw = await self.qloo.places(CITY_QUERY.get(city, city), ids, take=50, explain=True)
        return in_town(city, rl.dining(raw)), {p["entity_id"] for p in raw if p.get("entity_id")}

    async def resolve(self, interests: list[InterestIn]) -> tuple[list[Entity], list[dict[str, Any]]]:
        found = await asyncio.gather(
            *[resolve_interest(self.qloo, i, x.name, x.id) for i, x in enumerate(interests[:MAX_INTERESTS])]
        )
        entities: list[Entity] = []
        for f in found:  # the same favourite typed twice counts once
            if isinstance(f, Entity) and all(e.id != f.id for e in entities):
                entities.append(f)
        issues: list[dict[str, Any]] = []
        for f in found:
            if isinstance(f, Clarify):
                issues.append({"kind": "clarify", "field": f.field, "query": f.query,
                               "question": f.question, "options": f.options})
            elif isinstance(f, NotFound):
                issues.append({"kind": "not_found", "field": f.field, "query": f.query, "message": f.message})
        return entities, issues

    async def edit(self, city: str, guests: list[Entity], budget: int) -> dict[str, Any]:
        city = check_city(city)
        names = {g.id: g.name for g in guests}
        default, (taste, match_ids) = await asyncio.gather(
            self.default_list(city), self.taste_places(city, [g.id for g in guests])
        )
        result = rl.redline(default, taste, names, budget=budget, match_ids=match_ids)
        return {
            "match_count": len(match_ids),
            "city": city,
            "guest": [g.public() for g in guests],
            "budget": budget,
            "default": [rl.public_place(p) for p in default],
            **result,
        }

    async def run(self, city: str, interests: list[InterestIn], budget: int = 5) -> dict[str, Any]:
        """Resolve (ask when unclear) → default list → taste matches → redline."""
        city = check_city(city)
        trace = start_trace()
        if budget not in rl.BUDGETS:
            budget = 5
        entities, issues = await self.resolve(interests)
        if issues:
            return {"status": "needs_input", "issues": issues, "resolved": [e.public() for e in entities]}
        if not entities:
            return {"status": "needs_input", "issues": [], "resolved": []}
        out = await self.edit(city, entities, budget)
        return {
            "status": "ok",
            **out,
            "cached": trace.cached,
            "cache_age_seconds": round(trace.cache_age_seconds),
            "live_calls": trace.live_calls,
            "fallback": bool(trace.notes),
        }

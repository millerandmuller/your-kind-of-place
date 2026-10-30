"""One service behind the HTTP API, the agent and the MCP tool: same inputs, same redline."""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import redline as rl
from .qloo import QlooClient, start_trace
from .resolve import Clarify, Entity, NotFound, resolve_interest

CITIES = ("London", "San Francisco", "New York", "Austin", "Berlin")
DEMO_FILE = Path(__file__).resolve().parents[2] / "demo-data" / "demo_guests.json"
MAX_INTERESTS = 3


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


def load_demo() -> dict[str, Any]:
    try:
        return json.loads(DEMO_FILE.read_text())
    except (OSError, ValueError):
        return {"pairs": []}


class Redliner:
    def __init__(self, qloo: QlooClient, length: int = 10):
        self.qloo = qloo
        self.length = length

    async def default_list(self, city: str) -> list[dict[str, Any]]:
        """The city's top dining places with no taste signal: the stand-in for the hotel's list."""
        places = await self.qloo.places(check_city(city), take=50)
        return rl.dining(places)[: self.length]

    async def taste_places(self, city: str, ids: list[str]) -> tuple[list[dict[str, Any]], set[str]]:
        """The guest's top 50 Qloo matches: (dining places in rank order, ids of all 50)."""
        raw = await self.qloo.places(check_city(city), ids, take=50, explain=True)
        return rl.dining(raw), {p["entity_id"] for p in raw if p.get("entity_id")}

    async def resolve(self, interests: list[InterestIn]) -> tuple[list[Entity], list[dict[str, Any]]]:
        found = await asyncio.gather(
            *[resolve_interest(self.qloo, i, x.name, x.id) for i, x in enumerate(interests[:MAX_INTERESTS])]
        )
        entities = [f for f in found if isinstance(f, Entity)]
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
        }

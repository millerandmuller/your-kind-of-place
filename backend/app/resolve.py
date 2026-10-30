"""Resolving a guest's favourites in Qloo. Never guesses silently: an unclear match becomes a question."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any

from .qloo import INTEREST_TYPES, QlooClient


def norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-z0-9 ]+", " ", text.lower())
    text = re.sub(r"^(the) ", "", text.strip())
    return re.sub(r"\s+", " ", text).strip()


@dataclass
class Entity:
    id: str
    name: str
    description: str = ""
    kind: str = ""  # artist | tv_show | movie | brand | videogame

    def public(self) -> dict[str, str]:
        return {"id": self.id, "name": self.name, "kind": self.kind}


@dataclass
class Clarify:
    field: str  # "interest:<index>"
    query: str
    options: list[dict[str, str]]
    question: str


@dataclass
class NotFound:
    field: str
    query: str
    message: str


def _names(candidate: dict[str, Any]) -> set[str]:
    names = {norm(candidate.get("name", ""))}
    for aka in candidate.get("properties", {}).get("akas", []) or []:
        value = aka.get("value") if isinstance(aka, dict) else None
        if value:
            names.add(norm(value))
    names.discard("")
    return names


def _describe(candidate: dict[str, Any]) -> str:
    props = candidate.get("properties", {}) or {}
    return (props.get("short_description") or props.get("description") or "")[:140]


def _kind(candidate: dict[str, Any]) -> str:
    for t in candidate.get("types") or []:
        if t in INTEREST_TYPES:
            return t.rsplit(":", 1)[-1]
    return ""


def _entity(candidate: dict[str, Any]) -> Entity:
    return Entity(candidate["entity_id"], candidate["name"], _describe(candidate), _kind(candidate))


def _option(candidate: dict[str, Any]) -> dict[str, Any]:
    year = (candidate.get("properties") or {}).get("release_year")
    return {
        "id": candidate["entity_id"],
        "name": candidate["name"],
        "kind": _kind(candidate),
        "year": year if isinstance(year, int) else None,  # tells "Dune" 2021 from "Dune" 1984
        "description": _describe(candidate),
    }


# A same-named entry below this popularity is a stub (a fan video, an unknown film), not a rival.
NOTABLE = 0.1
# One exact match this popular, with every other exact match at least LEAD below it, is what people
# mean ("Succession" the show, not the 2009 film). It is taken and its type is shown on the result.
DOMINANT = 0.9
LEAD = 0.15


def pick(query: str, candidates: list[dict[str, Any]]) -> Entity | list[dict[str, Any]] | None:
    """Return one Entity when the match is unambiguous, else the candidates to ask about.

    Unambiguous = exactly one notable candidate whose name or alias equals the query. Several notable
    equal matches ("Amy Winehouse" the artist and a hit film of that name) are always a question. A
    near-match ("Jo Malone" returning "Jo Malone London") is never accepted on its own.
    """
    if not candidates:
        return None
    q = norm(query)
    exact = [c for c in candidates if q in _names(c)]
    notable = [c for c in exact if (c.get("popularity") or 0) >= NOTABLE]
    if len(notable) == 1:
        return _entity(notable[0])
    ranked = sorted(notable, key=lambda c: c.get("popularity") or 0, reverse=True)
    if len(ranked) > 1 and (ranked[0].get("popularity") or 0) >= DOMINANT and (
        (ranked[0].get("popularity") or 0) - (ranked[1].get("popularity") or 0) >= LEAD
    ):
        return _entity(ranked[0])
    if len(exact) == 1:
        return _entity(exact[0])
    if len(exact) > 1:
        # Several real matches ("Chris Evans"): popularity is not a reason to guess for the user.
        return sorted(exact, key=lambda c: c.get("popularity", 0) or 0, reverse=True)[:3]
    return candidates[:3]


async def resolve_interest(
    qloo: QlooClient, index: int, query: str, chosen_id: str | None = None
) -> Entity | Clarify | NotFound:
    field = f"interest:{index}"
    results = await qloo.search(query, ",".join(INTEREST_TYPES), limit=6)
    if chosen_id:
        for c in results:
            if c["entity_id"] == chosen_id:
                return _entity(c)
        # the user's pick didn't come back for this query; trust the id, keep the typed name
        return Entity(chosen_id, query)
    if not results:
        return NotFound(field, query, "We couldn't find this in Qloo's graph. Try a band, show, film or brand.")
    decision = pick(query, results)
    if isinstance(decision, Entity):
        return decision
    options = [_option(c) for c in (decision or [])]
    return Clarify(field, query, options, f"{len(options)} matches for ‘{query}’. Which one do you mean?")

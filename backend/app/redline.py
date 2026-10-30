"""The redline: the city's default list, edited for one guest. Deterministic, no model involved.

Rules (also shown on the "How this works" page):
- Struck: default entries that are not among the guest's top taste matches, lowest on the list first,
  at most `budget` of them.
- Inserted: the guest's best taste matches that are not on the list yet, one per struck entry, in
  Qloo's rank order. Each insert takes the place of a struck entry (top struck slot gets the best match).
- Kept: everything else, unmarked.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

GENRE_PREFIX = "urn:tag:genre:place:"

# Qloo's restaurant tag also returns hotels, shops, arenas and fast-food chains. A concierge
# doesn't hand those out, so both lists keep only sit-down food and drink by Qloo's primary genre.
DINING_EXTRA = {"pub", "brewery", "bar_&_grill", "southern_restaurant_(us)", "jazz_club", "winery"}
NOT_A_RECOMMENDATION = {
    "restaurant:fast_food",
    "restaurant:pizza_delivery",
    "restaurant:food_court",
    "restaurant:chicken",
    "restaurant:chicken_wings",
    "restaurant:hot_dog",
    "restaurant:chinese_takeaway",
}

STRIKE_NOTE = "Not among this guest's top 50 taste matches"
BUDGETS = (3, 5, 10)


def genre_of(place: dict[str, Any]) -> str:
    """'restaurant:cocktail_bar' etc.; empty when Qloo has no primary genre."""
    gid = (place.get("properties") or {}).get("primary_genre") or ""
    return gid[len(GENRE_PREFIX):] if gid.startswith(GENRE_PREFIX) else ""


def is_dining(place: dict[str, Any]) -> bool:
    genre = genre_of(place)
    if not genre or genre in NOT_A_RECOMMENDATION:
        return False
    return genre == "restaurant" or genre.startswith("restaurant:") or genre in DINING_EXTRA


def kind_label(place: dict[str, Any]) -> str:
    genre = genre_of(place)
    leaf = genre.split(":")[-1] if genre else "restaurant"
    label = leaf.replace("_", " ").replace("(us)", "").strip()
    return label[:1].upper() + label[1:]


def dining(places: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out = []
    for p in places:
        pid = p.get("entity_id")
        if pid and pid not in seen and is_dining(p):
            seen.add(pid)
            out.append(p)
    return out


def drivers(place: dict[str, Any], names: dict[str, str]) -> list[dict[str, Any]]:
    """Which of the guest's favourites pulled this place up, strongest first (Qloo explainability)."""
    expl = ((place.get("query") or {}).get("explainability") or {}).get("signal.interests.entities") or []
    rows = [
        {"id": e.get("entity_id"), "name": names.get(e.get("entity_id"), ""), "score": float(e.get("score") or 0)}
        for e in expl
        if isinstance(e, dict) and e.get("entity_id") in names
    ]
    return sorted(rows, key=lambda r: r["score"], reverse=True)


def insert_note(place: dict[str, Any], names: dict[str, str]) -> str:
    """'Because you love Amy Winehouse · Spitalfields · Pub' — every part comes from Qloo."""
    ds = drivers(place, names)
    if not ds:
        lead = "A top taste match for this guest"
    elif len(ds) > 1 and ds[0]["score"] - ds[1]["score"] < 0.1:
        lead = f"Because you love {ds[0]['name']} and {ds[1]['name']}"
    else:
        lead = f"Because you love {ds[0]['name']}"
    hood = (place.get("properties") or {}).get("neighborhood")
    return " · ".join(x for x in (lead, hood, kind_label(place)) if x)


def public_place(place: dict[str, Any]) -> dict[str, Any]:
    props = place.get("properties") or {}
    loc = place.get("location") or {}
    return {
        "id": place.get("entity_id"),
        "name": place.get("name"),
        "kind": kind_label(place),
        "neighborhood": props.get("neighborhood"),
        "address": props.get("address"),
        "description": props.get("short_description"),
        "price_level": props.get("price_level"),
        "lat": loc.get("lat"),
        "lon": loc.get("lon"),
    }


@dataclass
class Line:
    status: str  # keep | strike | insert
    place: dict[str, Any]
    note: str = ""
    why: list[dict[str, Any]] | None = None
    replaces: str | None = None

    def public(self) -> dict[str, Any]:
        out: dict[str, Any] = {"status": self.status, "place": public_place(self.place), "note": self.note}
        if self.why is not None:
            out["why"] = self.why
        if self.replaces:
            out["replaces"] = self.replaces
        return out


def redline(
    default: list[dict[str, Any]],
    taste: list[dict[str, Any]],
    names: dict[str, str],
    budget: int = 5,
    match_ids: set[str] | None = None,
) -> dict[str, Any]:
    """Edit `default` for a guest. Pure function.

    `taste` is the guest's ranked dining matches (inserts come from here); `match_ids` is the full
    top-50 Qloo answer before the dining filter (a default entry in there is never struck).
    """
    taste_set = match_ids if match_ids is not None else {p["entity_id"] for p in taste}
    default_ids = {p["entity_id"] for p in default}

    strike_pool = [i for i, p in enumerate(default) if p["entity_id"] not in taste_set]
    strike_pool.reverse()  # lowest on the list first
    insert_pool = [p for p in taste if p["entity_id"] not in default_ids]
    n = max(0, min(budget, len(strike_pool), len(insert_pool)))
    struck = sorted(strike_pool[:n])  # back into list order: the top struck slot gets the best match
    inserts = dict(zip(struck, insert_pool[:n]))

    lines: list[Line] = []
    final: list[dict[str, Any]] = []
    for i, p in enumerate(default):
        if i in inserts:
            lines.append(Line("strike", p, STRIKE_NOTE))
            new = inserts[i]
            lines.append(
                Line("insert", new, insert_note(new, names), drivers(new, names), replaces=p["entity_id"])
            )
            final.append(new)
        else:
            lines.append(Line("keep", p))
            final.append(p)
    return {
        "lines": [line.public() for line in lines],
        "final": [public_place(p) for p in final],
        "changed": n,
        "length": len(default),
        "possible": min(len(strike_pool), len(insert_pool)),
    }


def shared(a: list[dict[str, Any]], b: list[dict[str, Any]]) -> int:
    """How many places two final lists have in common (counted, not estimated)."""
    return len({p["id"] for p in a} & {p["id"] for p in b})

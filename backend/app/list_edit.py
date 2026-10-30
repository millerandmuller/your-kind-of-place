"""The edited list: the hotel's or the city's list, edited for one guest. Deterministic, no model involved.

Rules (also shown on the "How this works" page):
- Struck: list entries that are not among the guest's top taste matches, the ones with the lowest
  Qloo taste affinity for this guest first (ties and missing scores: lowest on the list first), at
  most `budget` of them.
- Inserted: the guest's best taste matches that are not on the list yet, one per struck entry, in
  Qloo's rank order. Each insert takes the place of a struck entry (top struck slot gets the best match).
- Kept: everything else, unmarked.
"""
from __future__ import annotations

import re
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
    "restaurant:hamburger",
    "restaurant:ice_cream_shop",
    "restaurant:donut_shop",
    "restaurant:bubble_tea_store",
}

# Airport lounges and terminal outlets: "Heathrow Airport", "Terminal 3 Nelson Rd".
_AIRPORT = re.compile(r"\bairport\b|\bterminal\s*\d", re.I)

# Chains a concierge wouldn't put on a hotel's list, matched by the start of the name.
CHAINS = (
    "hard rock cafe", "pizzaexpress", "pizza express", "starbucks", "mcdonald", "five guys", "bubba gump",
    "planet hollywood", "rainforest cafe", "the cheesecake factory", "cheesecake factory", "nando's", "wagamama",
    "hooters", "tgi friday", "olive garden", "shake shack", "pret a manger", "costa coffee", "le pain quotidien",
    "dunkin", "chipotle", "subway", "domino's", "kfc", "burger king", "in-n-out", "applebee", "chili's",
    "buffalo wild wings", "ihop", "denny's", "pizza hut", "papa john", "taco bell", "wendy's", "honest burgers",
    "franco manca", "ladurée", "laduree", "black & blue", "wahaca", "zizzi", "prezzo", "bella italia", "côte brasserie",
    "cote brasserie", "gail's", "leon ", "itsu", "yo! sushi", "yo sushi", "pizza pilgrims", "byron", "patty & bun",
    "tortilla", "chiquito", "frankie & benny", "carluccio", "giraffe", "las iguanas", "bill's", "the real greek",
    "joe & the juice", "blue bottle coffee", "peet's", "tim hortons", "panera", "p.f. chang", "cheesecake",
    "vapiano", "block house", "l'osteria", "hans im glück", "dean & david", "maredo",
)
UNMATCHED = "line:"  # entity id prefix for hotel-list lines Qloo doesn't know

STRIKE_NOTE = "Not among this guest's top 50 taste matches"  # Qloo's page size; see match_count
BUDGETS = (3, 5, 10)


def genre_of(place: dict[str, Any]) -> str:
    """'restaurant:cocktail_bar' etc.; empty when Qloo has no primary genre."""
    gid = (place.get("properties") or {}).get("primary_genre") or ""
    return gid[len(GENRE_PREFIX):] if gid.startswith(GENRE_PREFIX) else ""


def is_dining(place: dict[str, Any], allow_chains: bool = False) -> bool:
    """Sit-down food or drink. A hotel's own list may name a chain on purpose (allow_chains)."""
    genre = genre_of(place)
    if not genre or genre in NOT_A_RECOMMENDATION or is_adult(place):
        return False
    if not allow_chains and is_chain(place):
        return False
    props = place.get("properties") or {}
    if _AIRPORT.search(f"{props.get('address') or ''} {place.get('name') or ''}"):
        return False  # lounges and terminal outlets aren't somewhere to send a guest
    return genre == "restaurant" or genre.startswith("restaurant:") or genre in DINING_EXTRA


def is_chain(place: dict[str, Any]) -> bool:
    name = str(place.get("name") or "").lower().replace("’", "'")
    return name.startswith(CHAINS)


def kind_label(place: dict[str, Any]) -> str:
    if str(place.get("entity_id", "")).startswith(UNMATCHED):
        return ""
    genre = genre_of(place)
    leaf = genre.split(":")[-1] if genre else "restaurant"
    label = leaf.replace("_", " ").replace("(us)", "").strip()
    return label[:1].upper() + label[1:]


# Not for a hotel's list in any category: Qloo files some strip clubs under plain "Night club",
# so the genre, the genre tags and the place description are all checked.
_ADULT = re.compile(
    r"\bstrip ?(club|joint|bar|show)|\bstrippers?\b|\bstriptease|gentlem[ae]n'?s club|\blap ?danc|exotic danc"
    r"|\bpole ?danc|\btable ?danc|\bgo ?go danc|\btopless (bar|club|danc|waitress)|\bnude (bar|club|danc|cabaret|show)"
    r"|adult (entertainment|club|cabaret|store|shop)|\bsex (shop|club|store)|\bswingers?\b|\bfetish\b|\bpeep ?show",
    re.I,
)
# Names that are adult chains whatever Qloo's text says.
_ADULT_NAMES = re.compile(r"spearmint rhino|\bhustler\b|\bscores\b|playboy club|sapphire las vegas|déjà vu|deja vu showgirls", re.I)


def _plain(text: str) -> str:
    """One spelling for the patterns: straight apostrophes, spaces for hyphens and underscores."""
    return re.sub(r"[-_‐‑–—]", " ", text.replace("’", "'").replace("‘", "'"))


def is_adult(place: dict[str, Any]) -> bool:
    props = place.get("properties") or {}
    tags = " ".join(str(t.get("name") or "") for t in place.get("tags") or [] if isinstance(t, dict))
    name = str(place.get("name") or "")
    text = _plain(f"{genre_of(place)} {tags} {name} {props.get('description') or ''} {props.get('short_description') or ''}")
    return bool(_ADULT.search(text) or _ADULT_NAMES.search(_plain(name)))


NIGHTLIFE = {"live_music_venue", "night_club", "jazz_club", "concert_hall", "comedy_club", "dance_hall",
             "disco_club", "karaoke_bar", "event_venue", "performing_arts_theater", "pub", "brewery"}


def is_nightlife(place: dict[str, Any], allow_chains: bool = False) -> bool:
    """Venues, clubs, bars and pubs Qloo files under live music and nightlife; no restaurants or shops."""
    genre = genre_of(place)
    if not genre or is_adult(place):
        return False
    bar = genre.startswith("restaurant:") and ("bar" in genre or "pub" in genre)
    if not (genre in NIGHTLIFE or bar):
        return False
    if not allow_chains and is_chain(place):
        return False
    props = place.get("properties") or {}
    return not _AIRPORT.search(f"{props.get('address') or ''} {place.get('name') or ''}")


KEEP = {"dining": is_dining, "nightlife": is_nightlife}


def dining(places: list[dict[str, Any]], category: str = "dining") -> list[dict[str, Any]]:
    """The category's places, deduplicated, in Qloo's order."""
    keep = KEEP[category]
    seen: set[str] = set()
    out = []
    for p in places:
        pid = p.get("entity_id")
        if pid and pid not in seen and keep(p):
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
        "typed": place.get("typed"),  # what the hotel's list said, when it was matched to a Qloo place
        "in_qloo": not str(place.get("entity_id", "")).startswith(UNMATCHED),
        "in_house": bool(place.get("in_house")),
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


def _ordinal(n: int) -> str:
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def strike_note(rank: list[dict[str, Any]] | None) -> str:
    """The reason in the margin: the place's taste-affinity rank on this list, when Qloo scored it."""
    if not rank:
        return STRIKE_NOTE
    r = rank[0]["rank_from_bottom"]
    which = "Lowest" if r == 1 else f"{_ordinal(r)} lowest"
    return f"{which} taste affinity on this list for this guest"


def _affinity_rank(place: dict[str, Any], default: list[dict[str, Any]], affinity: dict[str, float]):
    """Where this entry sits among the list's entries by the guest's taste affinity (1 = lowest)."""
    scored = sorted((v, k) for k, v in affinity.items() if k in {p["entity_id"] for p in default})
    for rank, (_, pid) in enumerate(scored, start=1):
        if pid == place["entity_id"]:
            return [{"rank_from_bottom": rank, "of": len(scored)}]
    return None


def redline(
    default: list[dict[str, Any]],
    taste: list[dict[str, Any]],
    names: dict[str, str],
    budget: int = 5,
    match_ids: set[str] | None = None,
    affinity: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Edit `default` for a guest. Pure function.

    `taste` is the guest's ranked dining matches (inserts come from here); `match_ids` is the full
    top-50 Qloo answer before the dining filter (a default entry in there is never struck);
    `affinity` is Qloo's taste affinity of this guest for each place on the list.
    """
    affinity = affinity or {}
    taste_set = match_ids if match_ids is not None else {p["entity_id"] for p in taste}
    default_ids = {p["entity_id"] for p in default}

    # Lines Qloo doesn't know can't be judged, so they are never struck.
    strike_pool = [
        i for i, p in enumerate(default) if p["entity_id"] not in taste_set and not p["entity_id"].startswith(UNMATCHED)
    ]
    # least affinity for this guest first; without a score, lowest on the list first
    strike_pool.sort(
        key=lambda i: (0, affinity[default[i]["entity_id"]], -i)
        if default[i]["entity_id"] in affinity
        else (1, 0.0, -i)  # unscored only after every scored entry
    )
    insert_pool = [p for p in taste if p["entity_id"] not in default_ids]
    n = max(0, min(budget, len(strike_pool), len(insert_pool)))
    struck = sorted(strike_pool[:n])  # back into list order: the top struck slot gets the best match
    inserts = dict(zip(struck, insert_pool[:n]))

    lines: list[Line] = []
    final: list[dict[str, Any]] = []
    for i, p in enumerate(default):
        if i in inserts:
            rank = _affinity_rank(p, default, affinity)
            lines.append(Line("strike", p, strike_note(rank), why=rank))
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

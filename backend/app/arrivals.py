"""Tomorrow's arrivals: CRM notes in, one redlined list per guest out.

Two steps, so the concierge stays in charge:
1. read_notes — an ADK agent reads each note and records the guest's favourites. Only words that
   literally appear in the note are kept; each one is then resolved in Qloo (asking when unclear).
2. morning_report — after the concierge confirmed the favourites, every guest gets the same
   deterministic redline as the single-guest view.
"""
from __future__ import annotations

import asyncio
from typing import Any

from google.adk.agents import LlmAgent
from google.adk.runners import InMemoryRunner
from google.genai import types

from .agent import adk_model
from .config import Settings
from .resolve import Clarify, Entity, NotFound, norm, resolve_interest
from .service import MAX_INTERESTS, InterestIn, Redliner

MAX_GUESTS = 6

INSTRUCTION = """\
You read a hotel's arrival notes, one numbered note per guest, written by the front desk or taken
from the CRM. For EVERY note call record_guest exactly once with the note's number and at most 3
things the guest loves that Qloo could know: a band or musician, a TV show, a film, a brand or a
video game. Copy each favourite exactly as it is written in the note. Skip food preferences,
allergies, room wishes and anything that is not a named band, show, film, brand or game. If a note
names none, call record_guest with an empty list. Do not add anything that is not in the note.
When every note is recorded, answer "done".
"""


def in_note(fav: str, note: str) -> bool:
    """The favourite must be written in the note (case, accents and punctuation ignored)."""
    f, n = norm(fav), norm(note)
    return bool(f) and f" {f} " in f" {n} "


async def extract(settings: Settings, notes: list[str]) -> tuple[list[list[str]], list[dict[str, Any]]]:
    """Favourites per note, as recorded by the agent and checked against the note text."""
    recorded: dict[int, list[str]] = {}
    log: list[dict[str, Any]] = []

    def record_guest(note_number: int, favourites: list[str]) -> dict[str, Any]:
        """Record up to 3 favourites (band, show, film, brand or game) for the numbered note."""
        i = note_number - 1
        if not 0 <= i < len(notes):
            return {"status": "error", "message": f"note_number must be 1..{len(notes)}"}
        kept = [f.strip() for f in favourites if in_note(f, notes[i])][:MAX_INTERESTS]
        dropped = [f for f in favourites if f.strip() not in kept]
        recorded[i] = kept
        log.append({"tool": "record_guest", "input": f"note {note_number}", "output": kept,
                    **({"dropped_not_in_note": dropped} if dropped else {})})
        return {"status": "ok", "kept": kept}

    agent = LlmAgent(name="arrivals_reader", model=adk_model(settings), instruction=INSTRUCTION, tools=[record_guest])
    runner = InMemoryRunner(agent=agent, app_name="redline-arrivals")
    session = await runner.session_service.create_session(app_name="redline-arrivals", user_id="web")
    prompt = "\n".join(f"{i + 1}. {n}" for i, n in enumerate(notes))
    async for _ in runner.run_async(
        user_id="web", session_id=session.id, new_message=types.Content(role="user", parts=[types.Part(text=prompt)])
    ):
        pass
    return [recorded.get(i, []) for i in range(len(notes))], log


async def read_notes(r: Redliner, settings: Settings, notes: list[dict[str, str]]) -> dict[str, Any]:
    texts = [n["text"] for n in notes[:MAX_GUESTS]]
    favs, log = await extract(settings, texts)

    async def resolve_all(names: list[str]) -> list[dict[str, Any]]:
        found = await asyncio.gather(*[resolve_interest(r.qloo, i, name) for i, name in enumerate(names)])
        out = []
        for name, f in zip(names, found):
            if isinstance(f, Entity):
                out.append({"query": name, "status": "ok", "entity": f.public()})
            elif isinstance(f, Clarify):
                out.append({"query": name, "status": "clarify", "question": f.question, "options": f.options})
            elif isinstance(f, NotFound):
                out.append({"query": name, "status": "not_found", "message": f.message})
        return out

    resolved = await asyncio.gather(*[resolve_all(f) for f in favs])
    return {
        "status": "ok",
        "guests": [
            {"label": n.get("label") or f"Guest {i + 1}", "text": n["text"], "favourites": res}
            for i, (n, res) in enumerate(zip(notes[:MAX_GUESTS], resolved))
        ],
        "trace": log,
    }


async def morning_report(
    r: Redliner, city: str, budget: int, guests: list[dict[str, Any]], hotel_lines: list[str] | None
) -> dict[str, Any]:
    async def one(g: dict[str, Any]) -> dict[str, Any]:
        interests = [InterestIn(x["name"], x.get("id")) for x in g["interests"][:MAX_INTERESTS]]
        if not interests:
            return {"label": g["label"], "result": {"status": "skipped", "message": "No favourites confirmed."}}
        return {"label": g["label"], "result": await r.run(city, interests, budget, hotel_lines)}

    rows = await asyncio.gather(*[one(g) for g in guests[:MAX_GUESTS]])
    return {"status": "ok", "city": city, "budget": budget, "guests": list(rows)}

"""The ADK agent. Free text about a guest in, the hotel's list edited for that guest out.

It decides in order: pick the favourites from the text → resolve each (ask when unclear) → read the
default list → read the guest's taste matches → redline → explain one change. Its tools are the same
service functions the HTTP API uses, so the agent cannot invent places or reasons: those only come
back from Qloo. Pattern follows adk-samples/core/python/deep-search (LlmAgent + function tools).
"""
from __future__ import annotations

from typing import Any

from google.adk.agents import LlmAgent
from google.adk.runners import InMemoryRunner
from google.genai import types

from . import redline as rl
from .config import Settings
from .qloo import start_trace
from .resolve import Clarify, Entity, NotFound, resolve_interest
from .service import CITIES, Redliner, check_city

INSTRUCTION = f"""\
You help a hotel concierge edit the hotel's standard list of restaurants and bars for one guest.
The guest is described in free text. Work in this order and never skip a step:
1. Pick at most 3 things the guest loves (a band, show, film, brand or game) from the text.
   Call resolve_interest once per favourite. If any call returns a question, STOP and repeat the
   question verbatim. Never pick a candidate yourself.
2. default_list(city) for the hotel's city. Cities: {", ".join(CITIES)}. Use the city named in the
   text if it is one of these, otherwise the hotel city given in the message.
3. taste_places(city, interest_ids)
4. redline(city, interest_ids, budget)
5. explain_place(place_name) for the first inserted place.
Then answer with one or two short sentences: how many of the list's entries changed and why the
first insert is there, using only the words returned by the tools. Never name a place, a reason or
a number that no tool returned. Never say a list is "better"; say it fits this guest's taste.
"""


class Workspace:
    """What the tools share during one run (the agent never sees raw Qloo payloads)."""

    def __init__(self, redliner: Redliner, city: str, budget: int):
        self.r = redliner
        self.city = city
        self.budget = budget
        self.entities: dict[str, Entity] = {}
        self.issues: list[dict[str, Any]] = []
        self.result: dict[str, Any] | None = None
        self.taste: dict[str, dict[str, Any]] = {}
        self.log: list[dict[str, Any]] = []


def build_tools(ws: Workspace):
    async def resolve_interest_tool(name: str) -> dict[str, Any]:
        """Find one favourite (band, show, film, brand or game) in Qloo. Returns a question when unclear."""
        found = await resolve_interest(ws.r.qloo, len(ws.entities) + len(ws.issues), name)
        if isinstance(found, Entity):
            ws.entities[found.id] = found
            ws.log.append({"tool": "resolve_interest", "input": name, "output": f"{found.name} ({found.kind})"})
            return {"status": "ok", "id": found.id, "name": found.name, "kind": found.kind}
        if isinstance(found, Clarify):
            ws.issues.append({"kind": "clarify", "field": found.field, "query": found.query,
                              "question": found.question, "options": found.options})
            ws.log.append({"tool": "resolve_interest", "input": name, "output": found.question})
            return {"status": "needs_input", "question": found.question,
                    "options": [f"{o['name']} ({o['kind']})" for o in found.options]}
        assert isinstance(found, NotFound)
        ws.issues.append({"kind": "not_found", "field": found.field, "query": found.query, "message": found.message})
        ws.log.append({"tool": "resolve_interest", "input": name, "output": found.message})
        return {"status": "not_found", "message": found.message}

    resolve_interest_tool.__name__ = "resolve_interest"

    async def default_list(city: str) -> dict[str, Any]:
        """The city's top restaurants and bars with no taste signal (stands in for the hotel's list)."""
        ws.city = check_city(city) if city.strip().lower() in {c.lower() for c in CITIES} else ws.city
        places = await ws.r.default_list(ws.city)
        ws.log.append({"tool": "default_list", "input": ws.city, "output": f"{len(places)} places"})
        return {"city": ws.city, "places": [p["name"] for p in places]}

    async def taste_places(city: str, interest_ids: list[str]) -> dict[str, Any]:
        """The guest's top taste matches among the city's restaurants and bars, best first."""
        ids = [i for i in interest_ids if i in ws.entities][:3]
        if not ids:
            return {"status": "error", "message": "resolve_interest must succeed first"}
        dining, _ = await ws.r.taste_places(ws.city, ids)
        ws.taste = {p["name"]: p for p in dining}
        ws.log.append({"tool": "taste_places", "input": [ws.entities[i].name for i in ids],
                       "output": f"{len(dining)} dining matches in the top 50"})
        return {"places": [p["name"] for p in dining[:15]]}

    async def redline(city: str, interest_ids: list[str], budget: int = 0) -> dict[str, Any]:
        """Edit the default list: strike entries outside the guest's top 50, insert the best matches."""
        ids = [i for i in interest_ids if i in ws.entities][:3]
        if not ids:
            return {"status": "error", "message": "resolve_interest must succeed first"}
        out = await ws.r.edit(ws.city, [ws.entities[i] for i in ids], ws.budget)
        ws.result = out
        ws.log.append({"tool": "redline", "input": {"budget": ws.budget},
                       "output": f"{out['changed']} of {out['length']} changed"})
        return {
            "changed": f"{out['changed']} of {out['length']}",
            "struck": [l["place"]["name"] for l in out["lines"] if l["status"] == "strike"],
            "inserted": [l["place"]["name"] for l in out["lines"] if l["status"] == "insert"],
        }

    async def explain_place(place_name: str) -> dict[str, Any]:
        """Why a place fits this guest: the favourite that drove it (Qloo explainability), area and type."""
        place = ws.taste.get(place_name)
        if place is None:
            return {"status": "error", "message": "Only places returned by taste_places can be explained."}
        names = {i: e.name for i, e in ws.entities.items()}
        note = rl.insert_note(place, names)
        ws.log.append({"tool": "explain_place", "input": place_name, "output": note})
        return {"note": note, "label": "Aggregate taste affinity from Qloo, not a review."}

    return [resolve_interest_tool, default_list, taste_places, redline, explain_place]


def adk_model(settings: Settings):
    if settings.llm_provider == "gemini":
        return settings.llm_model
    if settings.llm_provider == "anthropic":
        from google.adk.models.lite_llm import LiteLlm

        return LiteLlm(model=f"anthropic/{settings.llm_model}")
    raise RuntimeError("no LLM provider configured for the agent")


async def run_agent(redliner: Redliner, settings: Settings, text: str, city: str, budget: int) -> dict[str, Any]:
    """Let the agent drive the service. Returns the redline plus the agent's own tool trace."""
    trace = start_trace()
    ws = Workspace(redliner, check_city(city), budget if budget in rl.BUDGETS else 5)
    agent = LlmAgent(
        name="redline_concierge",
        model=adk_model(settings),
        instruction=INSTRUCTION,
        tools=build_tools(ws),
    )
    runner = InMemoryRunner(agent=agent, app_name="redline")
    session = await runner.session_service.create_session(app_name="redline", user_id="web")
    prompt = f"Hotel city: {ws.city}\nGuest: {text}"
    final = ""
    async for event in runner.run_async(
        user_id="web",
        session_id=session.id,
        new_message=types.Content(role="user", parts=[types.Part(text=prompt)]),
    ):
        if event.is_final_response() and event.content and event.content.parts:
            final = "".join(p.text or "" for p in event.content.parts)
    base = {"agent_said": final.strip(), "trace": ws.log}
    if ws.issues:
        return {"status": "needs_input", "issues": ws.issues,
                "resolved": [e.public() for e in ws.entities.values()], **base}
    if ws.result is None:
        return {"status": "error", **base}
    return {"status": "ok", **ws.result, "cached": trace.cached,
            "cache_age_seconds": round(trace.cache_age_seconds), "live_calls": trace.live_calls, **base}

"""HTTP surface: /api/edit, /api/agent, /api/demo, /api/cities, /api/health, and /mcp."""
from __future__ import annotations

import asyncio
import json
import os
import re
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator

from .cache import FileCache
from .config import Settings, load_settings
from .qloo import QlooError
from .service import CITIES, InterestIn, Redliner, UnknownCity, cached_label, load_demo

_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")
# Words the agent may not use about a list: we measured "fits this guest", nothing else.
_CLAIMS = re.compile(
    r"\b(better|best|worse|beats?|google|chatgpt|yelp|tripadvisor|michelin|rated|rating|score[sd]?|stars?|reviews?"
    r"|besser|beste[nmrs]?|schlechter|bewertung(en)?|sterne[n]?|meilleur(e|s|es)?|pire|avis|étoiles?|notée?s?)\b",
    re.I,
)
_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
          # German and French without "ein"/"un", which are also articles
          "zwei": 2, "drei": 3, "vier": 4, "fünf": 5, "sechs": 6, "sieben": 7, "acht": 8, "neun": 9, "zehn": 10,
          "deux": 2, "trois": 3, "quatre": 4, "cinq": 5, "sept": 7, "huit": 8, "neuf": 9, "dix": 10}
_SUMMARY = {
    "en": ("{} of {} entries changed.", " First insert: {} ({})."),
    "de": ("{} von {} Einträgen geändert.", " Erster neuer Eintrag: {} ({})."),
    "fr": ("{} entrées sur {} modifiées.", " Premier ajout : {} ({})."),
}


def guard_agent_text(result: dict[str, Any]) -> dict[str, Any]:
    """Keep the agent's sentence only if every number in it came from the tools and it makes no
    claim we didn't measure. Otherwise say the same thing from the result itself."""
    said = result.get("agent_said") or ""
    if result.get("status") != "ok":
        if _CLAIMS.search(said) or _NUMBER.search(said):
            result["agent_said"] = ""
        return result
    allowed = {str(result.get("changed")), str(result.get("length")), "50"}
    for line in result.get("lines", []):
        allowed.update(_NUMBER.findall(line.get("note", "") + " " + (line["place"].get("name") or "")))
    numbers = set(_NUMBER.findall(said)) | {
        str(_WORDS[w.lower()]) for w in re.findall(r"\b\w+\b", said) if w.lower() in _WORDS
    }
    if said and not _CLAIMS.search(said) and numbers <= allowed:
        result["agent_said_checked"] = True
        return result
    first = next((l for l in result.get("lines", []) if l["status"] == "insert"), None)
    head, tail = _SUMMARY.get(result.get("lang") or "en", _SUMMARY["en"])
    summary = head.format(result.get("changed"), result.get("length"))
    if first:
        summary += tail.format(first["place"]["name"], first["note"])
    result["agent_said"] = summary
    result["agent_said_checked"] = False
    return result


def _clean_text(v: str, low: int = 2) -> str:
    v = " ".join(v.split())
    try:
        v.encode("utf-8")  # lone surrogates can't be encoded and would crash the cache key
    except UnicodeEncodeError as exc:
        raise ValueError("text contains invalid characters") from exc
    if len(v) < low or any(ord(c) < 32 for c in v):
        raise ValueError("text is too short or has control characters")
    return v


class InterestBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    id: str | None = Field(default=None, max_length=64)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        return _clean_text(v)

    @field_validator("id")
    @classmethod
    def _id(cls, v: str | None) -> str | None:
        if v is not None and not _ID.match(v):
            raise ValueError("id must be a Qloo entity id")
        return v


class EditBody(BaseModel):
    city: str = Field(min_length=2, max_length=40)
    interests: list[InterestBody] = Field(min_length=1, max_length=3)
    budget: int = 5
    category: Literal["dining", "nightlife", "museums"] = "dining"
    lang: Literal["en", "de", "fr"] = "en"  # language of the margin notes
    hotel_list: list[str] | None = Field(default=None, max_length=40)  # the hotel's own list, one place per line

    @field_validator("hotel_list")
    @classmethod
    def _lines(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        # Blank and one-character lines are skipped, not errors; the cap counts real lines only.
        lines = [" ".join(x.split()) for x in v]
        lines = [x for x in lines if len(x) >= 2 and all(ord(c) >= 32 for c in x)]
        if any(len(x) > 120 for x in lines):
            raise ValueError("each line of the hotel's list must be under 120 characters")
        if len(lines) > 10:
            raise ValueError("the hotel's list can have up to 10 lines")
        return [_clean_text(x) for x in lines] or None


class AgentBody(BaseModel):
    text: str = Field(min_length=3, max_length=400)
    city: str = Field(default="London", min_length=2, max_length=40)
    budget: int = 5
    lang: Literal["en", "de", "fr"] = "en"  # language of the agent's answer and the notes
    hotel_list: list[str] | None = Field(default=None, max_length=40)

    _hotel = field_validator("hotel_list")(EditBody._lines.__func__)

    @field_validator("text")
    @classmethod
    def _text(cls, v: str) -> str:
        return _clean_text(v, 3)


class RateLimiter:
    """Per-client sliding window; keeps one visitor from burning the shared Qloo key."""

    def __init__(self, per_minute: int, global_per_minute: int):
        self.per_minute = per_minute
        self.global_per_minute = global_per_minute
        self.hits: dict[str, deque[float]] = defaultdict(deque)
        self.all: deque[float] = deque()

    def allow(self, client: str) -> bool:
        now = time.monotonic()
        while self.all and now - self.all[0] > 60:
            self.all.popleft()
        if len(self.all) >= self.global_per_minute:  # holds even if a caller rotates identities
            return False
        if len(self.hits) > 2000:  # forget idle clients so the table can't grow without bound
            for key in [k for k, w in self.hits.items() if not w or now - w[-1] > 60]:
                del self.hits[key]
        window = self.hits[client]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= self.per_minute:
            return False
        window.append(now)
        self.all.append(now)
        return True


class NoteBody(BaseModel):
    label: str = Field(default="", max_length=60)
    text: str = Field(min_length=3, max_length=300)

    @field_validator("text")
    @classmethod
    def _text(cls, v: str) -> str:
        return _clean_text(v, 3)


class ReadNotesBody(BaseModel):
    notes: list[NoteBody] = Field(min_length=1, max_length=6)


class ArrivalGuest(BaseModel):
    label: str = Field(default="", max_length=60)
    interests: list[InterestBody] = Field(default_factory=list, max_length=3)
    not_considered: list[str] = Field(default_factory=list, max_length=6)

    @field_validator("not_considered")
    @classmethod
    def _other(cls, v: list[str]) -> list[str]:
        return [" ".join(x.split())[:80] for x in v if x.strip()]


class ReportBody(BaseModel):
    city: str = Field(min_length=2, max_length=40)
    budget: int = 5
    lang: Literal["en", "de", "fr"] = "en"
    category: Literal["dining", "nightlife", "museums"] = "dining"
    guests: list[ArrivalGuest] = Field(min_length=1, max_length=6)
    hotel_list: list[str] | None = Field(default=None, max_length=40)

    _hotel = field_validator("hotel_list")(EditBody._lines.__func__)


def create_app(settings: Settings | None = None, redliner: Redliner | None = None) -> FastAPI:
    settings = settings or load_settings()
    state: dict[str, Any] = {}

    from .mcp_server import build_mcp

    mcp = build_mcp(lambda: state["redliner"])

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if redliner is None:
            from .qloo import QlooClient

            qloo = QlooClient(settings, FileCache(settings.cache_dir))
            state["redliner"] = Redliner(qloo, settings.window)
            state["close"] = [qloo.aclose]
        else:
            state["redliner"] = redliner
            state["close"] = []
        async with mcp.session_manager.run():
            yield
        for close in state["close"]:
            await close()

    app = FastAPI(title="Your Kind of Place", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # public read-only demo, no credentials, no cookies
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def bad_input(_: Request, exc: RequestValidationError):
        # Never echo the input back: a lone surrogate in it made the 422 itself fail to serialise.
        msgs = [f"{'.'.join(str(p) for p in e.get('loc', [])[1:])}: {e.get('msg', 'invalid')}" for e in exc.errors()]
        return JSONResponse({"detail": "; ".join(msgs)[:300]}, status_code=422)

    limiter = RateLimiter(settings.rate_limit_per_minute, int(os.getenv("GLOBAL_LIMIT_PER_MINUTE", "120")))
    # The web app's server-side proxy sends the visitor's address with a shared secret. Anyone else
    # is keyed by the last X-Forwarded-For entry, the one Cloud Run's front end appended itself.
    proxy_secret = os.getenv("PROXY_SECRET", "")

    def client_key(request: Request) -> str:
        if proxy_secret and request.headers.get("x-proxy-secret") == proxy_secret:
            visitor = request.headers.get("x-proxy-visitor", "").strip()
            if visitor:
                return f"web:{visitor[:64]}"
        parts = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
        if parts:
            return parts[-1]
        return request.client.host if request.client else "?"

    def guard(request: Request) -> None:
        if not limiter.allow(client_key(request)):
            raise HTTPException(429, "Too many requests. Give it a minute.")

    # Model runs cost money: a tighter budget per visitor and for the whole instance.
    llm_limiter = RateLimiter(int(os.getenv("LLM_PER_MINUTE", "6")), int(os.getenv("LLM_GLOBAL_PER_MINUTE", "30")))

    def llm_guard(request: Request) -> None:
        guard(request)
        if not llm_limiter.allow(client_key(request)):
            raise HTTPException(429, "The agent is busy. Give it a minute, or use the form.")

    @app.middleware("http")
    async def edge_limits(request: Request, call_next):
        if request.method == "POST":
            if int(request.headers.get("content-length") or 0) > 16_384:
                return JSONResponse({"detail": "Request too large."}, status_code=413)
            if request.url.path.startswith("/mcp") and not limiter.allow(client_key(request)):
                return JSONResponse({"detail": "Too many requests. Give it a minute."}, status_code=429)
        return await call_next(request)

    def labelled(result: dict[str, Any]) -> dict[str, Any]:
        if result.get("status") == "ok":
            result["cached"] = cached_label(result)
        return result

    @app.get("/api/health")
    async def health() -> dict[str, Any]:
        return {"ok": True, "llm": settings.llm_provider, "model": settings.llm_model, "length": settings.window}

    @app.get("/api/cities")
    async def cities() -> dict[str, Any]:
        return {"cities": list(CITIES)}

    @app.get("/api/demo")
    async def demo() -> dict[str, Any]:
        return load_demo()

    @app.post("/api/edit")
    async def make_edit(body: EditBody, request: Request) -> dict[str, Any]:
        guard(request)
        r: Redliner = state["redliner"]
        try:
            return labelled(
                await asyncio.wait_for(
                    r.run(
                        body.city, [InterestIn(i.name, i.id) for i in body.interests], body.budget, body.hotel_list,
                        body.category, body.lang,
                    ),
                    timeout=45,
                )
            )
        except UnknownCity as exc:
            raise HTTPException(422, str(exc)) from exc
        except asyncio.TimeoutError as exc:
            raise HTTPException(504, "Qloo is slow right now. Try again in a moment.") from exc
        except QlooError as exc:
            raise qloo_http_error(exc) from exc

    @app.post("/api/agent")
    async def agent(body: AgentBody, request: Request) -> dict[str, Any]:
        """Free text in, an edited list out: the ADK agent picks the favourites, asks when unclear, edits."""
        llm_guard(request)
        from .agent import run_agent

        try:
            return guard_agent_text(labelled(
                await asyncio.wait_for(run_agent(state["redliner"], settings, body.text, body.city, body.budget, body.hotel_list, lang=body.lang), timeout=52)
            ))
        except asyncio.TimeoutError as exc:
            raise HTTPException(504, "The agent took too long. Try the form instead.") from exc
        except QlooError as exc:
            raise qloo_http_error(exc) from exc
        except Exception as exc:  # noqa: BLE001 — model/ADK trouble must not surface as a bare 500
            raise HTTPException(503, f"The agent couldn't run: {exc.__class__.__name__}") from exc

    @app.post("/api/agent/stream")
    async def agent_stream(body: AgentBody, request: Request) -> StreamingResponse:
        """The same agent run, as newline-delimited JSON: one {"step"} per tool call as it happens,
        then {"result"} or {"error"}. Lets the UI show what the agent is doing while it works."""
        llm_guard(request)
        from .agent import run_agent

        queue: asyncio.Queue = asyncio.Queue()

        async def work() -> None:
            try:
                out = await asyncio.wait_for(
                    run_agent(state["redliner"], settings, body.text, body.city, body.budget, body.hotel_list,
                              on_step=lambda s: queue.put_nowait({"step": s}), lang=body.lang),
                    timeout=52,
                )
                queue.put_nowait({"result": guard_agent_text(labelled(out))})
            except asyncio.TimeoutError:
                queue.put_nowait({"error": {"status": 504, "detail": "The agent took too long. Try the form instead."}})
            except QlooError as exc:
                err = qloo_http_error(exc)
                queue.put_nowait({"error": {"status": err.status_code, "detail": err.detail}})
            except Exception as exc:  # noqa: BLE001
                queue.put_nowait({"error": {"status": 503, "detail": f"The agent couldn't run: {exc.__class__.__name__}"}})

        async def lines():
            task = asyncio.create_task(work())
            try:
                while True:
                    item = await queue.get()
                    yield json.dumps(item, default=str) + "\n"
                    if "result" in item or "error" in item:
                        break
            finally:
                task.cancel()

        return StreamingResponse(lines(), media_type="application/x-ndjson")

    @app.post("/api/resolve")
    async def resolve(body: InterestBody, request: Request) -> dict[str, Any]:
        """Find one favourite in Qloo, without a model: a match, a question, or not found."""
        guard(request)
        from .resolve import Clarify, Entity, resolve_interest

        try:
            f = await resolve_interest(state["redliner"].qloo, 0, body.name, body.id)
        except QlooError as exc:
            raise qloo_http_error(exc) from exc
        if isinstance(f, Entity):
            return {"query": body.name, "status": "ok", "entity": f.public()}
        if isinstance(f, Clarify):
            return {"query": body.name, "status": "clarify", "question": f.question, "options": f.options}
        return {"query": body.name, "status": "not_found", "message": f.message}

    @app.post("/api/arrivals/read")
    async def arrivals_read(body: ReadNotesBody, request: Request) -> dict[str, Any]:
        """The agent reads tomorrow's notes; favourites come back for the concierge to confirm."""
        llm_guard(request)
        from .arrivals import read_notes

        try:
            return await asyncio.wait_for(
                read_notes(state["redliner"], settings, [n.model_dump() for n in body.notes]), timeout=50
            )
        except asyncio.TimeoutError as exc:
            raise HTTPException(504, "Reading the notes took too long. Try fewer guests.") from exc
        except QlooError as exc:
            raise qloo_http_error(exc) from exc
        except Exception as exc:  # noqa: BLE001 — model/ADK trouble must not surface as a bare 500
            raise HTTPException(503, f"The agent couldn't read the notes: {exc.__class__.__name__}") from exc

    @app.post("/api/arrivals/report")
    async def arrivals_report(body: ReportBody, request: Request) -> dict[str, Any]:
        """One edited list per confirmed guest: the morning report."""
        guard(request)
        from .arrivals import morning_report

        try:
            out = await asyncio.wait_for(
                morning_report(
                    state["redliner"], body.city, body.budget,
                    [g.model_dump() for g in body.guests], body.hotel_list, body.category, body.lang,
                ),
                timeout=50,
            )
        except UnknownCity as exc:
            raise HTTPException(422, str(exc)) from exc
        except asyncio.TimeoutError as exc:
            raise HTTPException(504, "Qloo is slow right now. Try again in a moment.") from exc
        except QlooError as exc:
            raise qloo_http_error(exc) from exc
        for g in out["guests"]:
            labelled(g["result"])
        return out

    app.mount("/mcp", mcp.streamable_http_app())
    return app


def qloo_http_error(exc: QlooError) -> HTTPException:
    if exc.status is not None and 400 <= exc.status < 500 and exc.status != 429:
        return HTTPException(422, "Qloo couldn't use one of these entries. Try a shorter or different name.")
    return HTTPException(503, "Qloo isn't answering right now and there's no saved answer for this guest.")


app = create_app() if __name__ != "__main__" else None  # uvicorn app.api:app

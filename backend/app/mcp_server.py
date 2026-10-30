"""The same capability as an open MCP tool: redline(city, interests[], budget)."""
from __future__ import annotations

import asyncio
from typing import Any, Callable

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from .redline import BUDGETS
from .service import cached_label
from .service import CITIES, InterestIn, Redliner, UnknownCity


def build_mcp(get_redliner: Callable[[], Redliner]) -> FastMCP:
    mcp = FastMCP(
        "redline",
        stateless_http=True,
        json_response=True,
        streamable_http_path="/",
        # public, read-only service reachable under any hostname
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )

    @mcp.tool()
    async def redline(city: str, interests: list[str], budget: int = 5) -> dict[str, Any]:
        """Edit a city's default list of restaurants and bars for one hotel guest.

        city: one of London, San Francisco, New York, Austin, Berlin.
        interests: 1-3 things the guest loves (a band, show, film, brand or game).
        budget: how many entries may change (3, 5 or 10).
        Returns the struck entries, the inserted ones with a note on which favourite drove each
        (Qloo explainability), and the final list. If a name is ambiguous the result is status
        "needs_input" with the question to ask; pick nothing yourself.
        Aggregate taste affinity from Qloo, not a review.
        """
        names = [" ".join(n.split()) for n in interests[:3]]
        if not names or any(len(n) < 2 or len(n) > 120 for n in names):
            return {"status": "error", "message": "Give 1-3 interests (2-120 characters each)."}
        if budget not in BUDGETS:
            return {"status": "error", "message": f"budget must be one of {list(BUDGETS)}"}
        try:
            result = await asyncio.wait_for(
                get_redliner().run(city, [InterestIn(n) for n in names], budget), timeout=45
            )
        except UnknownCity:
            return {"status": "error", "message": f"city must be one of {list(CITIES)}"}
        except asyncio.TimeoutError:
            return {"status": "error", "message": "Qloo is slow right now. Try again in a moment."}
        if result["status"] != "ok":
            return {"status": result["status"], "issues": result["issues"]}
        return {
            "status": "ok",
            "city": result["city"],
            "guest": result["guest"],
            "changed": f"{result['changed']} of {result['length']}",
            "struck": [l["place"]["name"] for l in result["lines"] if l["status"] == "strike"],
            "inserted": [
                {"name": l["place"]["name"], "note": l["note"]} for l in result["lines"] if l["status"] == "insert"
            ],
            "final": [p["name"] for p in result["final"]],
            "label": "Aggregate taste affinity from Qloo, not a review.",
            "cached": cached_label(result),
        }

    return mcp

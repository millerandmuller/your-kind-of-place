# Redline

**Every hotel guest gets the same list. Redline edits it for each guest.**

A boutique hotel hands every guest the same list of restaurants and bars. Redline returns that list per guest in track-changes mode: generic entries struck through in red, better-fitting places inserted in green, and a margin note on every change saying why. The reasons come from Qloo's taste graph, not from a language model. Two opposite guests in the same hotel get two very different versions.

Built for the concierge and guest-experience team, who keep the last word: every change can be accepted or rejected, then sent to the guest as a printable list.

**Live demo:** https://redline-hotel.vercel.app · **How it works (in the app):** `/how`

## What it does

1. **Default list.** Qloo Insights for dining places in the city with no taste signal. It stands in for the hotel's own list.
2. **Guest.** Up to three favourites (a band, show, film, brand or game), resolved with Qloo search. If a name is ambiguous, Redline asks. It never guesses.
3. **Taste matches.** The same Insights query with the guest's favourites as the signal and `feature.explainability=true`.
4. **Redline (deterministic).** Struck: default entries that are not in the guest's top 50, lowest on the list first, up to the swap budget (3, 5 or 10). Inserted: the guest's best matches that aren't on the list yet, one per struck entry. Kept: everything else. Nothing is padded.
5. **Margin notes.** Inserts name the favourite that Qloo's explainability score says drove the place, plus Qloo's neighbourhood and place type. Strikes say "Not among this guest's top 50 taste matches".
6. **Agent.** A Google ADK agent (Claude via LiteLLM) takes free text such as "Guest checking in tonight: loves Amy Winehouse and Dr. Martens", picks the favourites, asks when unclear and runs the same tools: `resolve_interest`, `default_list`, `taste_places`, `redline`, `explain_place`. Its tool calls are shown in the UI.
7. **MCP.** The same capability as an MCP tool at `/mcp/`: `redline(city, interests[], budget)`.

Cities: London, San Francisco, New York, Austin, Berlin.

### Dining filter

Qloo's restaurant tag (`urn:tag:genre:place:restaurant`) also returns hotels, department stores, arenas and fast-food chains. A concierge doesn't recommend those, so both lists keep only sit-down food and drink by Qloo's `primary_genre` (restaurants, bars, pubs, cafés; no fast food, burger, ice-cream or donut shops, delivery or food courts), and drop anything at an airport or more than 25 km from the city centre (for New York, Qloo is asked for "New York City"). See `backend/app/redline.py` and `backend/app/service.py`.

## What we measured, and what we don't claim

Measured once before building (25 October 2026; San Francisco, Austin and London; 12 pairs of deliberately opposite guests; restaurant-tag query without the dining filter):

- **Blind matching:** a separate model, with no hint of Qloo, matched the two lists to the two guest profiles correctly in **11 of 12** cases.
- **Stability:** the same queries 14 minutes later overlapped **0.99**.
- **Default vs. taste:** a guest's list and the no-signal list overlapped **0.12**.

**Limits:** Fits this guest, not 'better'. Even similar tastes get different lists, so we don't claim anything about similar guests. The judge was a language model, and 12 cases is a small sample.

## Architecture

```
Next.js (Vercel) ──/api rewrite──▶ FastAPI + ADK agent (Cloud Run) ──▶ Qloo hackathon.api.qloo.com
                                        ├─ Claude via LiteLLM (agent only)
                                        ├─ /mcp  redline(city, interests[], budget)
                                        └─ private file cache (never in this repo)
```

- `backend/app/redline.py` — the pure redline function, dining filter and notes
- `backend/app/service.py` — default list, taste matches, resolution; shared by API, agent and MCP
- `backend/app/agent.py` — ADK `LlmAgent` with five function tools
- `backend/app/qloo.py`, `cache.py` — Qloo client with a request-hash cache; when live Qloo fails, a saved answer is used and labelled "cached result"
- `frontend/app/Redline.tsx` — the track-changes view

## Run it locally

```bash
cp .env.example .env            # add QLOO_API_KEY, and ANTHROPIC_API_KEY for the agent
cd backend && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.api:app --port 8080
.venv/bin/python -m pytest -q   # engine, filter, resolver and API tests

cd ../frontend && npm ci && API_URL=http://127.0.0.1:8080 npm run dev
```

Without an LLM key the form, the redline and MCP still work; only "Ask the agent" needs a model.

## Data

No Qloo responses are stored in this repository. `demo-data/demo_guests.json` holds only the names and Qloo entity ids of the demo guests. Place data comes live from Qloo (or from the server's private cache). Notes are aggregate taste affinity from Qloo, not reviews or endorsements.

## AI use

This project was built with AI coding assistance (Claude Code). At runtime the agent uses Claude through LiteLLM to read free text and call the tools; it never chooses places or writes reasons. Those come from Qloo.

## Coming next

Paste the hotel's own list instead of the city default.

## License

MIT, see [LICENSE](LICENSE).

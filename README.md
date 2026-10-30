# Redline

**Every hotel guest gets the same list. Redline edits it for each guest.**

A boutique hotel hands every guest the same list of restaurants and bars. Redline returns that list per guest in track-changes mode: entries struck through in red where this guest's taste points elsewhere, places that fit this guest inserted in green, and a margin note on every change saying why. The reasons come from Qloo's taste graph, not from a language model. Two opposite guests in the same hotel get two very different versions.

Built for the concierge and guest-experience team, who keep the last word: every change can be accepted or rejected, then sent to the guest as a printable list.

**Live demo:** https://redline-hotel.vercel.app · **How it works (in the app):** `/how`

## What it does

1. **Default list, or the hotel's own.** Qloo Insights for dining places in the city with no taste signal stands in for the hotel's list. A concierge can paste the hotel's own list instead (up to 10 lines): each line is matched to a restaurant or bar in Qloo within 25 km (exact name first, then a place whose name contains the line, then one whose name the line contains; shown as "listed as …"). Chains the hotel lists itself are kept. Lines that don't match stay as typed and are never struck; repeats are skipped and shown.
2. **Guest.** Up to three favourites (a band, show, film, brand or game), resolved with Qloo search. If a name is ambiguous, Redline asks. It never guesses.
3. **Taste matches.** The same Insights query with the guest's favourites as the signal and `feature.explainability=true`.
4. **Redline (deterministic).** Struck: list entries that are not in the guest's top 50, the ones with the lowest Qloo taste affinity for this guest first (Insights restricted to the list's own places with `filter.results.entities`), up to the swap budget (3, 5 or 10). Inserted: the guest's best matches that aren't on the list yet, one per struck entry. Kept: everything else. Nothing is padded.
5. **Margin notes.** Inserts name the favourite that Qloo's explainability score says drove the place, plus Qloo's neighbourhood and place type. Strikes say "Not among this guest's top 50 taste matches".
6. **Agent.** A Google ADK agent (Claude via LiteLLM) takes free text such as "Guest checking in tonight: loves Amy Winehouse and Dr. Martens", picks the favourites, asks when unclear and runs the same tools: `resolve_interest`, `default_list`, `taste_places`, `redline`, `explain_place`. Its tool calls are shown in the UI.
7. **Tomorrow's arrivals.** Paste up to six arrival notes ("Room 204: Ms Patel. Loves Amy Winehouse, always in Dr. Martens. Nut allergy."). A second ADK agent records up to three favourites per note via a `record_guest` tool; the server keeps only favourites literally written in the note and resolves them in Qloo. The concierge confirms them, then gets a morning report with one redlined list per guest (copy or print). `POST /api/arrivals/read`, `POST /api/arrivals/report`.
8. **MCP.** The same capability as an MCP tool at `https://redline-api-588508999301.us-east1.run.app/mcp/`: `redline(city, interests[], budget, hotel_list[])`. A hotel's existing concierge or messaging agent can call it with the hotel's own list and the guest's favourites and get the struck and inserted places with their notes back.

Cities: London, San Francisco, New York, Austin, Berlin.

### Dining filter

For the default list and the guest's matches: Qloo's restaurant tag (`urn:tag:genre:place:restaurant`) also returns hotels, department stores, arenas and fast-food chains. A concierge doesn't recommend those, so both lists keep only sit-down food and drink by Qloo's `primary_genre` (restaurants, bars, pubs, cafés; no fast food, burger, ice-cream or donut shops, delivery or food courts), drop well-known chains (a fixed list in `redline.py`), and drop anything at an airport or more than 25 km from the city centre (for New York, Qloo is asked for "New York City"). See `backend/app/redline.py` and `backend/app/service.py`.

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
                                        ├─ /mcp  redline(city, interests[], budget, hotel_list[])
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

Without an LLM key the form, the redline and MCP still work; only "Ask the agent" and reading arrival notes need a model.

## Data

No Qloo responses are stored in this repository. `demo-data/demo_guests.json` holds only the names and Qloo entity ids of the demo guests. Place data comes live from Qloo (or from the server's private cache). Notes are aggregate taste affinity from Qloo, not reviews or endorsements.

## AI use

This project was built with AI coding assistance (Claude Code). At runtime the agent uses Claude through LiteLLM to read free text and call the tools; it never chooses places or writes reasons. Those come from Qloo.

## Coming next

Pick the right branch when a hotel-list name matches several places.

## License

MIT, see [LICENSE](LICENSE).

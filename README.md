# Your Kind of Place

**Every hotel guest gets the same list. Your Kind of Place edits it for each guest.**

A boutique hotel hands every guest the same list of restaurants and bars. Your Kind of Place returns that list per guest in track-changes mode: entries struck through in red where this guest's taste points elsewhere, places that fit this guest inserted in green, and a margin note on every change saying why. The reasons come from Qloo's taste graph, not from a language model. Two opposite guests in the same hotel get two very different versions.

Built for the concierge and guest-experience team, who keep the last word: every change can be accepted or rejected, then sent to the guest as a printable list.

**Live demo:** https://your-kind-of-place.vercel.app · **How it works (in the app):** `/how`

## What it does

1. **Default list, or the hotel's own.** Qloo Insights for dining places in the city with no taste signal stands in for the hotel's list. A concierge can paste the hotel's own list instead (up to 10 lines): each line is matched to a restaurant or bar in Qloo within 25 km (exact name first, then a place whose name contains the line, then one whose name the line contains, when Qloo's search returns it; shown as "listed as …"; lines starting with "our", "my", "hotel's" or "in-house" are the hotel's own and not looked up). Chains the hotel lists itself are kept. Lines that don't match stay as typed and are never struck; repeats are skipped and shown.
2. **Guest.** Up to three favourites (a band, show, film, brand or game), resolved with Qloo search. If a name is ambiguous, it asks. It never guesses.
3. **Taste matches.** The same Insights query with the guest's favourites as the signal and `feature.explainability=true`.
4. **The edit (deterministic).** Struck: list entries that are not in the guest's top 50, the ones with the lowest Qloo taste affinity for this guest first (Insights restricted to the list's own places with `filter.results.entities`), up to "Lines that may change" (3, 5 or 10). Inserted: the guest's best matches that aren't on the list yet, one per struck entry, never below the list's own level (restaurants & bars: the median Qloo price level of the list; the guest's matches are asked for with `filter.price_level.min`, and on a list at level 3+ no pub replaces a restaurant). Kept: everything else. Nothing is padded.
5. **Margin notes.** Inserts name the favourite that Qloo's explainability score says drove the place, then up to three of the place's own Qloo tags (interest, ambience, "late night") and the neighbourhood, with the guest's Qloo affinity for the place as a small bar. Strikes name the place's rank by this guest's Qloo affinity among the list's places ("Lowest taste affinity on this list for this guest", "2nd lowest …"); a place Qloo gave no score says "Not among this guest's top 50 taste matches". The hotel's own places ("Our rooftop bar") are labelled "Hotel's own · kept as is".
6. **Agent.** A Google ADK agent (Claude via LiteLLM) takes free text such as "Guest checking in tonight: loves Amy Winehouse and Dr. Martens", picks the favourites, asks when unclear and runs the same tools: `resolve_interest`, `default_list`, `taste_places`, `edit_list`, `explain_place`, then `not_considered` (allergies, diet, occasions it copies word for word from the text; the server keeps only what is written there). Its tool calls stream to the UI as they happen (`POST /api/agent/stream`, newline-delimited JSON).
7. **Tomorrow's arrivals.** Paste up to six arrival notes ("Room 204: Ms Patel. Loves Amy Winehouse, always in Dr. Martens. Nut allergy."). A second ADK agent records up to three favourites per note via a `record_guest` tool; the server keeps only favourites literally written in the note and resolves them in Qloo. Favourites right after a negation in the same clause ("hates Coldplay") are dropped. The concierge confirms them (or skips the agent and types favourites per guest; `POST /api/resolve` needs no model), then gets a morning report with one full edited list per guest, on the hotel's own list if one was pasted (copy or print). `POST /api/arrivals/read`, `POST /api/arrivals/report`.
8. **MCP.** The same capability as an MCP tool at `https://your-kind-of-place-api-588508999301.us-east1.run.app/mcp/`: `edit_hotel_list(city, interests[], budget, hotel_list[])`. A hotel's existing concierge or messaging agent can call it with the hotel's own list and the guest's favourites and get back the names of the struck places, the inserted places with their notes, the final list and the lines it couldn't match.

Cities: London, San Francisco, New York, Austin (and Toronto and Montreal in the client demo).

Languages: English (default), German, French (switch in the top bar; the guest message can have its own language). The interface, the margin notes' own words, the guest message and "How this works" are translated; place names and Qloo's tags stay as Qloo has them. The agent answers in the chosen language under the same server check (numbers must come from the tools; no comparison words, in German and French too).

Look: day (cream) and night (warm dark), following the system setting and remembered once switched. (Berlin was dropped: its default list read like a sights list, not a hotel's.)

Links that open straight on a view (state lives in the URL):
- Guest 1, London: https://your-kind-of-place.vercel.app/?tab=g1&ex=0&lines=5
- Both guests side by side: https://your-kind-of-place.vercel.app/?tab=both&ex=0&lines=5
- Live music & nightlife for an Amy Winehouse fan: https://your-kind-of-place.vercel.app/?tab=own&city=London&kind=nightlife&fav=Amy%20Winehouse&id=10AE6E44-D058-4C1D-818F-FF4B37D069CB
- Client demo, Toronto: https://your-kind-of-place.vercel.app/client?city=Toronto

**Client demo.** The gold "Client demo" button opens what a guest of a hotel would see on their phone after check-in. The hotel, Montreonto Hotels, is fictional, with one house in Toronto and one in Montreal; the page says so. Inside a phone frame: a welcome for the guest, the house list edited for them (red strikes, inserts with their margin notes, "Map ↗" on every place that stays), a Toronto | Montreal switch, two sample guests per city with Canadian favourites (Drake + Canada Goose and Schitt's Creek + Roots; Céline Dion + Cirque du Soleil and Arcade Fire + Roots), tabs for restaurants & bars and after dark, and its own EN | FR switch. The house list is the city's top places with no taste signal, as in the main app; places, notes and tags are live Qloo results. Before the two cities were used they passed a smoke test and the same blind test (12 of 12, threshold 10, written down before the run); the sample guests are the test pair per city that shares the fewest additions. The test covered restaurants & bars only; the after-dark tab (live music & nightlife) was not tested in these two cities and in Montreal changes little (0 and 1 of 10 for the two sample guests). On a phone the frame goes and the guest view fills the screen.

Kinds of place: **Restaurants & bars** (the default and the demo) and **Live music & nightlife** (`filter.tags` live_music_venue + night_club; venues, clubs, bars and pubs only). Only what passes the blind test below goes into the product: shops (9 of 12), sights & attractions (3 of 12), parks (8), cafés (5) and spa (4) did not pass; museums & galleries passed at 10 of 12 but are left out because two opposite guests shared most museums. Adult venues are dropped in every category (Qloo genre, tag or description).

### Dining filter

For the default list and the guest's matches: Qloo's restaurant tag (`urn:tag:genre:place:restaurant`) also returns hotels, department stores, arenas and fast-food chains. A concierge doesn't recommend those, so both lists keep only sit-down food and drink by Qloo's `primary_genre` (restaurants, bars, pubs, cafés; no fast food, burger, ice-cream or donut shops, delivery or food courts), drop well-known chains (a fixed list in `list_edit.py`) and theme venues (Qloo decor tag "Themed"), and drop anything at an airport or more than 25 km from the city centre (for New York, Qloo is asked for "New York City"). See `backend/app/list_edit.py` and `backend/app/service.py`.

## What we measured, and what we don't claim

Blind test with 12 pairs of deliberately opposite guests in San Francisco, Austin and London, first on 25 October 2026 and again on 30 October with the product's dining filter and price-level rule:

- **Blind matching:** a separate model, with no hint of Qloo, matched the two lists to the two guest profiles correctly in **10 of 12** cases (11 of 12 without the price-level rule).
- **Stability** (first run): the same queries 14 minutes later overlapped **0.99**.
- **Default vs. taste** (first run): a guest's list and the no-signal list overlapped **0.12**.

**Categories, same blind test, threshold 10 of 12 set before the run:** live music & nightlife **10 of 12** (offered); museums & galleries 10 of 12 (passed, left out: low judge confidence and two opposite guests shared most museums); parks & gardens 8, shops 9, cafés 5, spa & wellness 4, sights & attractions 3 of 12 (not offered).

**Limits:** Fits this guest, not 'better'. Even similar tastes get different lists, so we don't claim anything about similar guests. The judge was a language model, and 12 cases is a small sample.

## Architecture

```
Next.js (Vercel) ──server-side proxy──▶ FastAPI + 2 ADK agents (Cloud Run) ──▶ Qloo hackathon.api.qloo.com
                                        ├─ Claude via LiteLLM (agents only: free-text guest, arrival notes)
                                        ├─ /mcp  edit_hotel_list(city, interests[], budget, hotel_list[])
                                        └─ private file cache (never in this repo)
```

- `backend/app/list_edit.py` — the pure edit function, dining filter and notes
- `backend/app/service.py` — default list, taste matches, resolution; shared by API, agent and MCP
- `backend/app/agent.py` — ADK `LlmAgent` with five function tools
- `backend/app/qloo.py`, `cache.py` — Qloo client with a request-hash cache; when live Qloo fails, a saved answer is used and labelled "cached result"
- `frontend/app/ListEditor.tsx` — the track-changes view

## Run it locally

```bash
cp .env.example .env            # add QLOO_API_KEY, and ANTHROPIC_API_KEY for the agent
cd backend && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.api:app --port 8080
.venv/bin/python -m pytest -q   # engine, filter, resolver and API tests

cd ../frontend && npm ci && API_URL=http://127.0.0.1:8080 npm run dev
```

Without an LLM key the form, the edited list and MCP still work; only "Ask the agent" and reading arrival notes need a model.

## Data

Sample guests are fictional. Artist, show and brand names only describe what a guest likes; no affiliation with or endorsement by them is implied.

No Qloo responses are stored in this repository. `demo-data/demo_guests.json` holds only the names and Qloo entity ids of the demo guests. Place data comes live from Qloo (or from the server's private cache). Notes are aggregate taste affinity from Qloo, not reviews or endorsements.

## AI use

This project was built with AI coding assistance (Claude Code). At runtime the agent uses Claude through LiteLLM to read free text and call the tools; it never chooses places or writes reasons. Those come from Qloo.

## Coming next

Pick the right branch when a hotel-list name matches several places.

## License

MIT, see [LICENSE](LICENSE).

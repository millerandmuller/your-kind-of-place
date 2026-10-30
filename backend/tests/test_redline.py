import httpx
from fastapi.testclient import TestClient

from app import redline as rl
from app.api import create_app, guard_agent_text
from app.service import cached_label
from app.cache import FileCache
from app.config import Settings
from app.qloo import QlooClient
from app.resolve import Entity, pick
from app.service import Redliner


def place(pid, genre="restaurant", hood=None, expl=None):
    p = {"entity_id": pid, "name": f"Place {pid}",
         "properties": {"primary_genre": f"urn:tag:genre:place:{genre}"}}
    if hood:
        p["properties"]["neighborhood"] = hood
    if expl:
        p["query"] = {"explainability": {"signal.interests.entities": expl}}
    return p


NAMES = {"A": "Amy Winehouse", "B": "Dr. Martens"}


def test_dining_filter_drops_hotels_shops_and_fast_food():
    places = [place("1"), place("2", "hotel"), place("3", "department_store"), place("4", "restaurant:fast_food"),
              place("5", "pub"), place("6", "restaurant:cocktail_bar"), place("1")]
    assert [p["entity_id"] for p in rl.dining(places)] == ["1", "5", "6"]


def test_strikes_lowest_entries_outside_the_top_50_and_inserts_best_matches():
    default = [place(str(i)) for i in range(10)]
    taste = [place("x1"), place("x2"), place("3"), place("x3")]
    match_ids = {"x1", "x2", "3", "x3", "8"}
    out = rl.redline(default, taste, NAMES, budget=3, match_ids=match_ids)
    struck = [l["place"]["id"] for l in out["lines"] if l["status"] == "strike"]
    inserted = [l["place"]["id"] for l in out["lines"] if l["status"] == "insert"]
    assert struck == ["6", "7", "9"]  # 8 is in the guest's top 50, so it stays
    assert inserted == ["x1", "x2", "x3"]  # 3 is already on the list
    assert [p["id"] for p in out["final"]] == ["0", "1", "2", "3", "4", "5", "x1", "x2", "8", "x3"]
    assert out["changed"] == 3 and out["length"] == 10
    notes = {l["note"] for l in out["lines"] if l["status"] == "strike"}
    assert notes == {rl.STRIKE_NOTE}


def test_never_pads_when_the_guest_has_few_new_matches():
    default = [place(str(i)) for i in range(10)]
    out = rl.redline(default, [place("x1")], NAMES, budget=10, match_ids={"x1"})
    assert out["changed"] == 1


def test_same_input_same_redline():
    default = [place(str(i)) for i in range(10)]
    taste = [place(f"x{i}") for i in range(8)]
    a = rl.redline(default, taste, NAMES, budget=5)
    b = rl.redline(default, taste, NAMES, budget=5)
    assert a == b


def test_insert_note_names_the_driving_favourite_from_explainability():
    p = place("x", "pub", "Spitalfields", [{"entity_id": "B", "score": 0.7}, {"entity_id": "A", "score": 0.3}])
    assert rl.insert_note(p, NAMES) == "Because you love Dr. Martens · Spitalfields · Pub"
    close = place("y", "restaurant:cocktail_bar", None, [{"entity_id": "A", "score": 0.52}, {"entity_id": "B", "score": 0.48}])
    assert rl.insert_note(close, NAMES) == "Because you love Amy Winehouse and Dr. Martens · Cocktail bar"
    assert rl.insert_note(place("z"), NAMES).startswith("A top taste match")


def test_pick_accepts_one_notable_exact_match_and_asks_otherwise():
    amy = [{"entity_id": "1", "name": "Amy Winehouse", "popularity": 1.0, "types": ["urn:entity:artist"]},
           {"entity_id": "2", "name": "Amy Winehouse", "popularity": 0, "types": ["urn:entity:movie"]}]
    found = pick("Amy Winehouse", amy)
    assert isinstance(found, Entity) and found.kind == "artist"
    two = [{"entity_id": "1", "name": "The Office", "popularity": 0.999, "types": ["urn:entity:tv_show"]},
           {"entity_id": "2", "name": "The Office", "popularity": 0.975, "types": ["urn:entity:tv_show"]}]
    assert isinstance(pick("The Office", two), list)
    clear = [{"entity_id": "1", "name": "Aesop", "popularity": 0.971, "types": ["urn:entity:brand"]},
             {"entity_id": "2", "name": "Aesop", "popularity": 0.61, "types": ["urn:entity:artist"]}]
    found = pick("Aesop", clear)
    assert isinstance(found, Entity) and found.kind == "brand"
    near = [{"entity_id": "1", "name": "Jo Malone London", "popularity": 0.9, "types": ["urn:entity:brand"]}]
    assert isinstance(pick("Jo Malone", near), list)


def settings(tmp_path, **kw) -> Settings:
    base = dict(
        qloo_api_key="k", qloo_base_url="https://qloo.test", cache_dir=tmp_path, cache_fresh_seconds=60,
        window=10, take=50, rate_limit_per_minute=30, llm_provider="none", llm_model="", llm_fallback_model="",
        gemini_api_key="", anthropic_api_key="",
    )
    base.update(kw)
    return Settings(**base)


def fake_qloo(req: httpx.Request) -> httpx.Response:
    if req.url.path == "/search":
        return httpx.Response(200, json={"results": [
            {"entity_id": "A", "name": "Amy Winehouse", "popularity": 1.0, "types": ["urn:entity:artist"]}]})
    signal = req.url.params.get("signal.interests.entities")
    if signal:
        ents = [place(f"g{i}", "pub", "Soho", [{"entity_id": "A", "score": 1.0}]) for i in range(12)]
        ents += [place("d0"), place("hotel1", "hotel")]
    else:
        ents = [place(f"d{i}") for i in range(10)] + [place("hotel2", "hotel")]
    return httpx.Response(200, json={"results": {"entities": ents}})


def test_api_redline_end_to_end_with_a_fake_qloo(tmp_path):
    s = settings(tmp_path)
    qloo = QlooClient(s, FileCache(tmp_path), transport=httpx.MockTransport(fake_qloo))
    app = create_app(s, Redliner(qloo, 10))
    with TestClient(app) as client:
        r = client.post("/api/redline", json={"city": "london", "interests": [{"name": "Amy Winehouse"}], "budget": 5})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "ok" and body["city"] == "London" and body["changed"] == 5
        assert all(p["kind"] != "Hotel" for p in body["final"])
        assert body["cached"] is False
        inserts = [l for l in body["lines"] if l["status"] == "insert"]
        assert inserts[0]["note"] == "Because you love Amy Winehouse · Soho · Pub"
        assert client.post("/api/redline", json={"city": "Paris", "interests": [{"name": "Amy"}]}).status_code == 422
        assert client.get("/api/demo").json()["pairs"][0]["city"] == "London"


def test_dining_filter_drops_burger_chains_and_airport_places():
    lounge = place("9")
    lounge["properties"]["address"] = "Terminal 3, Heathrow Airport, Hounslow"
    clubhouse = place("8")
    clubhouse["properties"]["address"] = "Terminal 3 Nelson Rd Longford Hounslow TW6 1QG"
    places = [place("1", "restaurant:hamburger"), lounge, clubhouse, place("2", "restaurant:ice_cream_shop"), place("3", "pub")]
    assert [p["entity_id"] for p in rl.dining(places)] == ["3"]


def _ok(said):
    return {"status": "ok", "changed": 5, "length": 10, "agent_said": said,
            "lines": [{"status": "insert", "note": "Because you love Amy Winehouse · Pub",
                       "place": {"name": "The Ten Bells"}}]}


def test_agent_text_kept_only_when_numbers_come_from_tools_and_no_claims():
    assert guard_agent_text(_ok("Five of the 10 entries changed; The Ten Bells is first."))["agent_said_checked"]
    out = guard_agent_text(_ok("This list is better than Google."))
    assert out["agent_said_checked"] is False and "better" not in out["agent_said"]
    out = guard_agent_text(_ok("7 of 10 changed and it scores 9.7."))
    assert out["agent_said"].startswith("5 of 10 entries changed")


def test_same_favourite_twice_counts_once(tmp_path):
    s = settings(tmp_path)
    qloo = QlooClient(s, FileCache(tmp_path), transport=httpx.MockTransport(fake_qloo))
    app = create_app(s, Redliner(qloo, 10))
    with TestClient(app) as client:
        body = client.post("/api/redline", json={"city": "London", "budget": 5, "interests": [
            {"name": "Amy Winehouse"}, {"name": "amy winehouse"}]}).json()
        assert [g["name"] for g in body["guest"]] == ["Amy Winehouse"]
        assert body["match_count"] == 14


def test_qloo_rejecting_an_input_is_not_reported_as_an_outage(tmp_path):
    s = settings(tmp_path)

    def bad(req):
        return httpx.Response(400, json={"error": "bad"})

    qloo = QlooClient(s, FileCache(tmp_path), transport=httpx.MockTransport(bad))
    with TestClient(create_app(s, Redliner(qloo, 10))) as client:
        r = client.post("/api/redline", json={"city": "London", "interests": [{"name": "Aesop"}]})
        assert r.status_code == 422 and "isn't answering" not in r.text


def test_rate_limit_key_ignores_spoofed_forwarded_for(tmp_path, monkeypatch):
    s = settings(tmp_path, rate_limit_per_minute=2)
    qloo = QlooClient(s, FileCache(tmp_path), transport=httpx.MockTransport(fake_qloo))
    with TestClient(create_app(s, Redliner(qloo, 10))) as client:
        body = {"city": "London", "interests": [{"name": "Amy Winehouse"}]}
        codes = [client.post("/api/redline", json=body, headers={"x-forwarded-for": f"10.0.0.{i}, 1.2.3.4"}).status_code
                 for i in range(4)]
        assert codes.count(429) == 2


def test_cached_label_only_when_nothing_was_live_or_qloo_failed():
    assert not cached_label({"cached": True, "live_calls": 1, "cache_age_seconds": 5000})  # new guest, cached default
    assert cached_label({"cached": True, "live_calls": 0, "cache_age_seconds": 5000})  # demo pair from the image
    assert not cached_label({"cached": True, "live_calls": 0, "cache_age_seconds": 30})  # same visit
    assert cached_label({"cached": True, "live_calls": 1, "cache_age_seconds": 30, "fallback": True})

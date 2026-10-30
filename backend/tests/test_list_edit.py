import httpx
from fastapi.testclient import TestClient

from app import list_edit as rl
from app.api import create_app, guard_agent_text
from app.service import cached_label, in_town
from app.cache import FileCache
from app.config import Settings
from app.qloo import QlooClient
from app.resolve import Entity, pick
from app.service import Redliner


def place(pid, genre="restaurant", hood=None, expl=None, lat=51.51, lon=-0.13):
    p = {"entity_id": pid, "name": f"Place {pid}", "location": {"lat": lat, "lon": lon},
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
    assert rl.insert_note(p, NAMES) == "Because the guest loves Dr. Martens · Spitalfields"
    close = place("y", "restaurant:cocktail_bar", None, [{"entity_id": "A", "score": 0.52}, {"entity_id": "B", "score": 0.48}])
    assert rl.insert_note(close, NAMES) == "Because the guest loves Amy Winehouse and Dr. Martens"
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
        r = client.post("/api/edit", json={"city": "london", "interests": [{"name": "Amy Winehouse"}], "budget": 5})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "ok" and body["city"] == "London" and body["changed"] == 5
        assert all(p["kind"] != "Hotel" for p in body["final"])
        assert body["cached"] is False
        inserts = [l for l in body["lines"] if l["status"] == "insert"]
        assert inserts[0]["note"] == "Because the guest loves Amy Winehouse · Soho"
        assert client.post("/api/edit", json={"city": "Paris", "interests": [{"name": "Amy"}]}).status_code == 422
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
        body = client.post("/api/edit", json={"city": "London", "budget": 5, "interests": [
            {"name": "Amy Winehouse"}, {"name": "amy winehouse"}]}).json()
        assert [g["name"] for g in body["guest"]] == ["Amy Winehouse"]
        assert body["match_count"] == 14


def test_qloo_rejecting_an_input_is_not_reported_as_an_outage(tmp_path):
    s = settings(tmp_path)

    def bad(req):
        return httpx.Response(400, json={"error": "bad"})

    qloo = QlooClient(s, FileCache(tmp_path), transport=httpx.MockTransport(bad))
    with TestClient(create_app(s, Redliner(qloo, 10))) as client:
        r = client.post("/api/edit", json={"city": "London", "interests": [{"name": "Aesop"}]})
        assert r.status_code == 422 and "isn't answering" not in r.text


def test_rate_limit_key_ignores_spoofed_forwarded_for(tmp_path, monkeypatch):
    s = settings(tmp_path, rate_limit_per_minute=2)
    qloo = QlooClient(s, FileCache(tmp_path), transport=httpx.MockTransport(fake_qloo))
    with TestClient(create_app(s, Redliner(qloo, 10))) as client:
        body = {"city": "London", "interests": [{"name": "Amy Winehouse"}]}
        codes = [client.post("/api/edit", json=body, headers={"x-forwarded-for": f"10.0.0.{i}, 1.2.3.4"}).status_code
                 for i in range(4)]
        assert codes.count(429) == 2


def test_cached_label_only_when_nothing_was_live_or_qloo_failed():
    assert not cached_label({"cached": True, "live_calls": 1, "cache_age_seconds": 5000})  # new guest, cached default
    assert cached_label({"cached": True, "live_calls": 0, "cache_age_seconds": 5000})  # demo pair from the image
    assert not cached_label({"cached": True, "live_calls": 0, "cache_age_seconds": 30})  # same visit
    assert cached_label({"cached": True, "live_calls": 1, "cache_age_seconds": 30, "fallback": True})


def test_places_far_from_the_city_centre_are_dropped():
    manhattan = place("m", lat=40.758, lon=-73.985)
    niagara = place("n", lat=43.09, lon=-79.06)
    white_plains = place("w", lat=41.03, lon=-73.76)
    assert [p["entity_id"] for p in in_town("New York", [manhattan, niagara, white_plains])] == ["m"]


def test_chains_are_dropped_by_name():
    hard_rock = place("h", "restaurant:american")
    hard_rock["name"] = "Hard Rock Cafe | Berlin"
    express = place("p", "restaurant:pizza")
    express["name"] = "PizzaExpress"
    assert rl.dining([hard_rock, express, place("ok")]) == [place("ok")]


def test_unknown_hotel_list_lines_are_never_struck():
    default = [place("1"), {"entity_id": "line:1", "name": "Chez Nous", "properties": {}}, place("3")]
    out = rl.redline(default, [place("x1"), place("x2"), place("x3")], NAMES, budget=10, match_ids=set())
    struck = [l["place"]["id"] for l in out["lines"] if l["status"] == "strike"]
    assert struck == ["1", "3"]
    kept = [l for l in out["lines"] if l["status"] == "keep"][0]["place"]
    assert kept["name"] == "Chez Nous" and kept["in_qloo"] is False


def hotel_qloo(req: httpx.Request) -> httpx.Response:
    if req.url.path == "/search" and "place" in req.url.params.get("types", ""):
        q = req.url.params["query"]
        if q == "Dishoom":
            return httpx.Response(200, json={"results": [
                {**place("far", lat=55.95, lon=-3.19), "name": "Dishoom Edinburgh"},
                {**place("dk"), "name": "Dishoom King's Cross"}]})
        return httpx.Response(200, json={"results": []})
    return fake_qloo(req)


def test_hotel_list_is_matched_in_town_and_redlined(tmp_path):
    s = settings(tmp_path)
    qloo = QlooClient(s, FileCache(tmp_path), transport=httpx.MockTransport(hotel_qloo))
    with TestClient(create_app(s, Redliner(qloo, 10))) as client:
        body = client.post("/api/edit", json={"city": "London", "budget": 5, "interests": [{"name": "Amy Winehouse"}],
                                                 "hotel_list": ["Dishoom", "Chez Nous"]}).json()
        assert body["source"] == "hotel"
        assert [p["name"] for p in body["default"]] == ["Dishoom King's Cross", "Chez Nous"]
        assert body["default"][0]["typed"] == "Dishoom" and body["default"][1]["in_qloo"] is False
        assert body["changed"] == 1  # only the matched line can be struck


def longer_qloo(req: httpx.Request) -> httpx.Response:
    if req.url.path == "/search" and "place" in req.url.params.get("types", ""):
        q = req.url.params["query"]
        museum = {**place("bm", "museum"), "name": "The British Museum"}
        kiln = {**place("kiln"), "name": "Kiln"}
        return httpx.Response(200, json={"results": [museum, kiln] if "Kiln" in q else [museum]})
    return fake_qloo(req)


def test_hotel_list_matches_shorter_qloo_names_skips_duplicates_and_non_dining(tmp_path):
    s = settings(tmp_path)
    qloo = QlooClient(s, FileCache(tmp_path), transport=httpx.MockTransport(longer_qloo))
    with TestClient(create_app(s, Redliner(qloo, 10))) as client:
        body = client.post("/api/edit", json={"city": "London", "budget": 5, "interests": [{"name": "Amy Winehouse"}],
                                                 "hotel_list": ["Kiln Soho", "Kiln", "British Museum", " ", "x"]}).json()
        assert [p["name"] for p in body["default"]] == ["Kiln", "British Museum"]
        assert body["default"][0]["typed"] == "Kiln Soho"
        assert body["default"][1]["in_qloo"] is False  # a museum is not a restaurant or bar
        assert body["skipped"] == ["Kiln"]


def test_strikes_follow_the_guests_affinity_not_the_list_position():
    default = [place(str(i)) for i in range(6)]
    taste = [place(f"x{i}") for i in range(6)]
    aff = {"0": 0.5, "1": 0.9, "2": 0.1, "3": 0.8, "4": 0.7, "5": 0.95}
    out = rl.redline(default, taste, NAMES, budget=2, match_ids=set(), affinity=aff)
    struck = [l["place"]["id"] for l in out["lines"] if l["status"] == "strike"]
    assert struck == ["0", "2"]  # the two lowest affinities, shown in list order
    assert out["lines"][0]["why"] == [{"rank_from_bottom": 2, "of": 6}]
    assert out["lines"][0]["note"] == "2nd lowest taste affinity on this list for this guest"
    by_id = {l["place"]["id"]: l for l in out["lines"] if l["status"] == "strike"}
    assert by_id["2"]["note"] == "Lowest taste affinity on this list for this guest"


def test_in_house_lines_and_partial_words_never_match(tmp_path):
    def q(req):
        if req.url.path == "/search" and "place" in req.url.params.get("types", ""):
            return httpx.Response(200, json={"results": [{**place("mh", "restaurant:bar"), "name": "Magic Hour Rooftop Bar"}]})
        return fake_qloo(req)

    s = settings(tmp_path)
    qloo = QlooClient(s, FileCache(tmp_path), transport=httpx.MockTransport(q))
    with TestClient(create_app(s, Redliner(qloo, 10))) as client:
        body = client.post("/api/edit", json={"city": "London", "budget": 5, "interests": [{"name": "Amy Winehouse"}],
                                                 "hotel_list": ["Our rooftop bar", "our rooftop bar & grill", "Hour Rooftop"]}).json()
        assert [p["in_qloo"] for p in body["default"]] == [False, False, True]
        assert [p["in_house"] for p in body["default"]] == [True, True, False]


def test_favourites_must_be_written_in_the_note():
    from app.arrivals import in_note

    note = "Room 204, Ms Patel: loves Amy Winehouse, always in Dr. Martens; nut allergy"
    assert in_note("Amy Winehouse", note) and in_note("dr martens", note)
    assert not in_note("Taylor Swift", note) and not in_note("Amy", "Amyx loves jazz")
    assert not in_note("Coldplay", "Hates Coldplay, loves Radiohead") and in_note("Radiohead", "Hates Coldplay, loves Radiohead")
    assert not in_note("Nike", "Not a fan of Nike") and not in_note("Succession", "never watch Succession")
    assert in_note("Beyoncé", "loves beyonce") and in_note("東京事変", "東京事変が大好き") and in_note("Земфира", "Любит Земфира")


def test_morning_report_redlines_each_confirmed_guest(tmp_path):
    s = settings(tmp_path)
    qloo = QlooClient(s, FileCache(tmp_path), transport=httpx.MockTransport(fake_qloo))
    with TestClient(create_app(s, Redliner(qloo, 10))) as client:
        body = client.post("/api/arrivals/report", json={"city": "London", "budget": 5, "guests": [
            {"label": "Room 204", "interests": [{"name": "Amy Winehouse"}]},
            {"label": "Room 310", "interests": []}]}).json()
        assert [g["label"] for g in body["guests"]] == ["Room 204", "Room 310"]
        assert body["guests"][0]["result"]["status"] == "ok" and body["guests"][0]["result"]["changed"] == 5
        assert body["guests"][1]["result"]["status"] == "skipped"


def test_unscored_entries_are_struck_only_after_scored_ones():
    default = [place(str(i)) for i in range(4)]
    out = rl.redline(default, [place(f"x{i}") for i in range(4)], NAMES, budget=2, match_ids=set(),
                     affinity={"0": 0.9, "1": 0.2, "3": 0.5})
    assert [l["place"]["id"] for l in out["lines"] if l["status"] == "strike"] == ["1", "3"]


def test_house_of_prime_rib_is_not_an_in_house_line():
    from app.service import IN_HOUSE
    assert not IN_HOUSE.match("House of Prime Rib") and IN_HOUSE.match("Our rooftop bar")


def test_resolve_endpoint_needs_no_model(tmp_path):
    s = settings(tmp_path)
    qloo = QlooClient(s, FileCache(tmp_path), transport=httpx.MockTransport(fake_qloo))
    with TestClient(create_app(s, Redliner(qloo, 10))) as client:
        body = client.post("/api/resolve", json={"name": "Amy Winehouse"}).json()
        assert body["status"] == "ok" and body["entity"]["id"] == "A"


def test_nightlife_keeps_venues_clubs_and_bars_only():
    strip = place("s", "night_club")
    strip["properties"]["description"] = "Massive luxury strip club on City Road with multiple stages"
    places = [place("v", "live_music_venue"), place("c", "night_club"), place("h", "hotel"), place("b", "restaurant:bar"),
              place("f", "restaurant:fish_and_chips"), place("r", "record_store"), strip, place("a", "adult_entertainment_club")]
    assert [p["entity_id"] for p in rl.dining(places, "nightlife")] == ["v", "c", "b"]


def test_category_reaches_qloo_and_comes_back(tmp_path):
    seen = []

    def q(req):
        if req.url.path == "/v2/insights":
            seen.append(req.url.params.get("filter.tags"))
        return fake_qloo(req)

    s = settings(tmp_path)
    qloo = QlooClient(s, FileCache(tmp_path), transport=httpx.MockTransport(q))
    with TestClient(create_app(s, Redliner(qloo, 10))) as client:
        body = client.post("/api/edit", json={"city": "London", "interests": [{"name": "Amy Winehouse"}],
                                              "category": "nightlife"}).json()
        assert body["category"] == "nightlife"
        assert any("night_club" in (x or "") for x in seen)
        assert client.post("/api/edit", json={"city": "London", "interests": [{"name": "Amy Winehouse"}],
                                               "category": "shops"}).status_code == 422


def _p(name="X", description=""):
    p = place("x", "night_club")
    p["name"] = name
    p["properties"]["description"] = description
    return p


def test_adult_filter_catches_variants_and_spares_ordinary_bars():
    for desc in ["Luxury strip-club with VIP booths", "Gentlemen’s Club with dancers", "Striptease show nightly",
                 "Pole dancing bar", "Nude cabaret", "Go-go dancers on the bar"]:
        assert rl.is_adult(_p(description=desc)), desc
    assert rl.is_adult(_p(name="Spearmint Rhino Gentlemen's Club"))
    assert rl.is_adult(_p(name="Hustler Club"))
    for desc in ["Rooftop bar, topless sunbathing not allowed", "Vegas-style bar on the Strip", "Jazz lounge with a stripped-back menu"]:
        assert not rl.is_adult(_p(description=desc)), desc


def _tagged(pid, price=None, **kinds):
    p = place(pid)
    if price:
        p["properties"]["price_level"] = price
    p["tags"] = [{"name": n, "type": f"urn:tag:{k}:qloo"} for k, names in kinds.items() for n in names]
    return p


def test_inserts_never_go_below_the_lists_price_level():
    default = [_tagged(str(i), price=lv) for i, lv in enumerate([4, 3, 3, 2, 4, 3, 1, 3, 4, 2])]
    assert rl.level_floor(default) == 3
    taste = [_tagged("pub", price=2), _tagged("fine", price=4), _tagged("nolevel"), _tagged("mid", price=3)]
    out = rl.redline(default, taste, NAMES, budget=5, match_ids=set(), floor=3)
    assert [l["place"]["id"] for l in out["lines"] if l["status"] == "insert"] == ["fine", "mid"]
    assert out["level"] == 3


def test_level_floor_needs_three_priced_entries():
    assert rl.level_floor([_tagged("a", price=4), _tagged("b"), _tagged("c", price=4)]) is None


def test_note_carries_the_places_own_qloo_tags():
    p = _tagged("x", interests=["Live jazz", "Mixology"], ambience=["Classic", "Soulful"],
                time_of_day_fit=["Evening", "Late night"])
    p["properties"]["neighborhood"] = "Soho"
    p["query"] = {"explainability": {"signal.interests.entities": [{"entity_id": "A", "score": 0.8}]}}
    assert rl.insert_note(p, NAMES) == "Because the guest loves Amy Winehouse · live jazz · soulful · late night · Soho"


def test_theme_venues_are_not_recommended_but_may_stay_on_the_hotels_own_list():
    p = _tagged("t", decor=["Celtic", "Themed"])
    assert not rl.is_dining(p) and rl.is_dining(p, allow_chains=True)


def test_no_pub_replaces_a_restaurant_on_an_upscale_list():
    default = [_tagged(str(i), price=4) for i in range(5)]
    pub = _tagged("pub", price=3); pub["properties"]["primary_genre"] = "urn:tag:genre:place:pub"
    out = rl.redline(default, [pub, _tagged("bar", price=3)], NAMES, budget=3, match_ids=set(), floor=3)
    assert [l["place"]["id"] for l in out["lines"] if l["status"] == "insert"] == ["bar"]


def test_not_considered_items_must_be_written_in_the_note():
    from app.arrivals import written_in
    note = "Loves Amy Winehouse. Nut allergy, celebrating their anniversary; wants a quiet room."
    assert written_in("nut allergy", note) and written_in("Quiet room", note)
    assert not written_in("vegetarian", note)



def test_notes_and_agent_fallback_speak_the_chosen_language():
    p = place("x", "pub", "Soho", [{"entity_id": "A", "score": 0.9}])
    assert rl.insert_note(p, NAMES, "de") == "Weil der Gast Amy Winehouse liebt · Soho"
    assert rl.insert_note(p, NAMES, "fr") == "Parce que le client aime Amy Winehouse · Soho"
    assert rl.strike_note([{"rank_from_bottom": 2, "of": 9}], "de").startswith("Zweitniedrigste")
    assert rl.strike_note([{"rank_from_bottom": 3, "of": 9}], "fr").startswith("3e affinité")
    r = {"status": "ok", "changed": 5, "length": 10, "lang": "de", "lines": [],
         "agent_said": "Diese Liste ist besser für den Gast."}
    out = guard_agent_text(r)
    assert out["agent_said_checked"] is False and out["agent_said"].startswith("5 von 10")

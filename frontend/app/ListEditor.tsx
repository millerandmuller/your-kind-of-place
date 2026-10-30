"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Arrivals from "./Arrivals";
import Nav from "./Nav";
import { LangContext, useLang, useT } from "./LangContext";
import { LANGS, LOCALE, translate, type Lang, type Vars } from "@/lib/lang";
import {
  api,
  BUDGETS,
  CATEGORIES,
  CITIES,
  categoryLabel,
  type Category,
  DEFAULT_LABEL,
  HOTEL_LABEL,
  SAMPLE_LISTS,
  finalList,
  guestName,
  LABEL,
  mapsUrl,
  agentStream,
  optionKind,
  shared,
  type DemoPair,
  type Issue,
  type Line,
  type NeedsInput,
  type Place,
  type EditResult,
  type TraceStep,
} from "@/lib/api";

type AffinityRank = { rank_from_bottom: number; of: number };

type T = (en: string, vars?: Vars) => string;

// "Every guest gets the *same list*" → text with <em> (single stars) and <strong> (double stars).
function rich(s: string) {
  return s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) =>
    part.startsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.startsWith("*") ? (
      <em key={i}>{part.slice(1, -1)}</em>
    ) : (
      part
    ),
  );
}

type Tab = "default" | "g1" | "g2" | "both" | "own" | "arrivals";

export type StartState = {
  lang: Lang;
  tab?: Tab;
  ex: number;
  lines: number;
  own: { city?: string; category: Category; favs: string[]; ids: string[] };
};

function meta(p: Place, t: T): string {
  if (p.in_house) return t("Hotel's own · kept as is");
  if (p.in_qloo === false) return t("Not matched to a restaurant or bar in Qloo · kept as is");
  const base = [p.kind, p.neighborhood].filter(Boolean).join(" · ");
  if (p.typed) return t("{base} · listed as “{typed}”", { base, typed: p.typed });
  return base;
}

function MapLink({ p, city }: { p: Place; city?: string }) {
  const t = useT();
  if (p.in_qloo === false || p.in_house) return null;
  return (
    <a className="maplink noprint" href={mapsUrl(p, city)} target="_blank" rel="noreferrer" aria-label={t("{name} on Google Maps", { name: p.name })} title={t("Open in Google Maps")}>
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
        <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.4 4.5 8.5 4.5 8.5s4.5-5.1 4.5-8.5A4.5 4.5 0 0 0 8 1.5Zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z" fill="currentColor" />
      </svg>
    </a>
  );
}

function Affinity({ value }: { value?: number }) {
  const t = useT();
  if (value === undefined || value === null) return null;
  return (
    <span className="aff" title={t("Qloo taste affinity of this guest for the place (0 to 1)")}>
      <span className="bar" aria-hidden="true">
        <span style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
      </span>
      <span className="val">{t("affinity {v}", { v: value.toFixed(2) })}</span>
    </span>
  );
}

function ignoredLines(text: string): number {
  return Math.max(0, text.split("\n").filter((l) => l.trim()).length - 10);
}

function pairLabel(p: DemoPair, t: T): string {
  return t("{city}: {a} vs. {b}", { city: p.city, a: guestName(p.guest1), b: guestName(p.guest2) });
}

export default function ListEditor({ start }: { start: StartState }) {
  const [lang, setLang] = useState<Lang>(start.lang);
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Editor start={start} />
    </LangContext.Provider>
  );
}

function Editor({ start }: { start: StartState }) {
  const lang = useLang();
  const t = useT();
  const [pairs, setPairs] = useState<DemoPair[]>([]);
  const [pairIdx, setPairIdx] = useState(start.ex);
  const [budget, setBudget] = useState(start.lines);
  const [tab, setTab] = useState<Tab>(start.tab ?? "default");
  const [results, setResults] = useState<Partial<Record<Tab, EditResult>>>({});
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hotelOpen, setHotelOpen] = useState(false);
  const [hotelText, setHotelText] = useState("");
  const [rejected, setRejected] = useState<Partial<Record<Tab, Set<string>>>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [animate, setAnimate] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const touched = useRef(start.tab !== undefined);  // a link to a tab means: no automatic switch

  const pair = pairs[pairIdx];
  const own = results.own;

  // Keep the view in the URL, so a reload or a shared link lands on the same list.
  useEffect(() => {
    const q = new URLSearchParams({ tab, ex: String(pairIdx), lines: String(budget) });
    if (tab === "own" && own) {
      q.set("city", own.city);
      q.set("kind", own.category ?? "dining");
      own.guest.forEach((g) => {
        q.append("fav", g.name);
        q.append("id", g.id);
      });
    }
    window.history.replaceState(null, "", `?${q.toString()}`);
  }, [tab, pairIdx, budget, own]);

  useEffect(() => {
    api.demo().then((d) => setPairs(d.pairs)).catch((e) => setError(e.message));
  }, []);

  // Load both demo guests whenever the example or the swap budget changes (or on "Try again").
  useEffect(() => {
    if (!pair) return;
    let live = true;
    const load = (key: "g1" | "g2", g: typeof pair.guest1) =>
      api
        .edit(pair.city, g.map((x) => ({ name: x.name, id: x.id })), budget, undefined, "dining", lang)
        .then((res) => {
          if (!live) return;
          if (res.status === "ok") setResults((r) => ({ ...r, [key]: res }));
          else setError(t("This example needs a pick first. Try another example."));
        })
        .catch((e) => live && setError(e.message));
    load("g1", pair.guest1);
    load("g2", pair.guest2);
    return () => {
      live = false;
    };
  }, [pair, budget, attempt, lang, t]);

  const resetDemo = () => {
    setResults((r) => ({ own: r.own }));
    setRejected((r) => ({ own: r.own }));
    setError(null);
    setOpen(null);
    setSendOpen(false);
  };

  const choose = (t: Tab) => {
    touched.current = true;
    setAnimate(t !== "default");
    setOpen(null);
    setSendOpen(false);
    setTab(t);
  };

  const current =
    tab === "default" ? results.g1 : tab === "both" || tab === "arrivals" ? undefined : results[tab];
  const rej = useMemo(() => rejected[tab] ?? new Set<string>(), [rejected, tab]);
  const toggle = (strikeId: string, reject: boolean) =>
    setRejected((r) => {
      const next = new Set(r[tab] ?? []);
      if (reject) next.add(strikeId);
      else next.delete(strikeId);
      return { ...r, [tab]: next };
    });

  const g1 = results.g1;
  const g2 = results.g2;
  const none = new Set<string>();
  const shareCount = g1 && g2 ? shared(finalList(g1, rejected.g1 ?? none), finalList(g2, rejected.g2 ?? none)) : null;

  return (
    <main className="wrap">
      <Nav />
      <header className="hero noprint">
        <h1>{rich(t("Every guest gets the *same list*. We edit it into **their kind of place**."))}</h1>
        <p>
          {t(
            "The hotel's list of restaurants and bars, edited per guest in track changes, with a reason from Qloo's taste data on every change.",
          )}
        </p>
      </header>

      <div className="controls noprint">
        <label>
          {t("Example")}
          <select
            value={pairIdx}
            onChange={(e) => {
              touched.current = true;
              resetDemo();
              setPairIdx(Number(e.target.value));
              if (tab === "own") setTab("g1");
              setAnimate(true);
            }}
          >
            {pairs.map((p, i) => (
              <option key={i} value={i}>
                {pairLabel(p, t)}
              </option>
            ))}
          </select>
        </label>
        <span className="ctl">
          {t("Lines that may change")}
          <span className="seg" role="group" aria-label={t("Lines that may change")}>
            {BUDGETS.map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={budget === b}
                onClick={() => {
                  if (b === budget) return;
                  touched.current = true;
                  resetDemo();
                  setAnimate(true);
                  setBudget(b);
                }}
              >
                {b}
              </button>
            ))}
          </span>
        </span>
      </div>

      <div className="tabs noprint" role="tablist" aria-label={t("Whose list")}>
        <TabButton id="default" tab={tab} choose={choose} kicker={pair ? t("Hotel in {city}", { city: pair.city }) : t("Hotel")} title={t("Default list")} />
        <TabButton id="g1" tab={tab} choose={choose} kicker={t("Guest 1 checks in")} title={pair ? guestName(pair.guest1) : "…"} />
        <TabButton id="g2" tab={tab} choose={choose} kicker={t("Guest 2, same hotel")} title={pair ? guestName(pair.guest2) : "…"} />
        <TabButton id="both" tab={tab} choose={choose} kicker={t("Compare")} title={`${t("Guest 1")} | ${t("Guest 2")}`} />
        <TabButton id="own" tab={tab} choose={choose} kicker={t("Try your own")} title={t("Your guest (and list)")} />
        <TabButton id="arrivals" tab={tab} choose={choose} kicker={t("Tomorrow's arrivals")} title={t("Morning report")} />
      </div>

      {error && (
        <p className="err">
          {error}{" "}
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setError(null);
              setAttempt((a) => a + 1);
            }}
          >
            {t("Try again")}
          </button>
        </p>
      )}

      {(
        <div hidden={tab !== "arrivals"}>
        <Arrivals
          budget={budget}
          hotelLines={hotelText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 10)}
        />
        </div>
      )}

      {(
        <div hidden={tab !== "own"}>
        <OwnGuest
          start={start.own}
          budget={budget}
          hotelOpen={hotelOpen}
          hotelText={hotelText}
          setHotelText={setHotelText}
          onStart={() => setResults((x) => ({ ...x, own: undefined }))}
          onResult={(r) => {
            setAnimate(true);
            setResults((x) => ({ ...x, own: r }));
            setRejected((x) => ({ ...x, own: new Set() }));
            setOpen(null);
          }}
        />
        </div>
      )}

      {tab === "both" && g1 && g2 && (
        <SideBySide a={g1} b={g2} ra={rejected.g1 ?? none} rb={rejected.g2 ?? none} share={shareCount ?? 0} />
      )}

      {tab !== "both" && tab !== "arrivals" && (tab !== "own" || results.own) && (
        <section className={`sheet${animate ? " animate" : ""}`} key={`${tab}-${current?.city}-${current?.budget}-${guestName(current?.guest ?? [])}`}>
          <div className="sheet-head">
            <div>
              <h2>
                {current
                  ? t("{what} in {city}", { what: t(categoryLabel(current.category)), city: current.city })
                  : t(categoryLabel())}
              </h2>
              <span className="for">
                {!current
                  ? t("For every guest")
                  : tab === "default"
                    ? t("Left: the list every guest gets. Right: the same list for Guest 1.")
                    : t("For a guest who loves {names}", {
                        names: current.guest.map((g) => (g.kind ? `${g.name} (${g.kind.replace("_", " ")})` : g.name)).join(" + "),
                      })}
              </span>
            </div>
            <div>
              {current?.cached && <span className="badge" title={t("Answered from saved Qloo results")}>{t("cached result")}</span>}{" "}
              {current && tab === "own" && <span className="badge">{t("up to {n} lines change", { n: current.budget })}</span>}{" "}
              {current && tab !== "default" && (
                <span className="count">
                  {t("{n} of {m} changed", { m: current.length }).split("{n}")[0]}
                  <span className="red">{current.changed - [...rej].length}</span>
                  {t("{n} of {m} changed", { m: current.length }).split("{n}")[1]}
                </span>
              )}
            </div>
          </div>
          <p className="label">
            {t(current?.source === "hotel" ? HOTEL_LABEL : DEFAULT_LABEL)}
            {current?.skipped?.length ? `. ${t("Skipped as repeats: {list}", { list: current.skipped.join(", ") })}` : ""}
            {tab === "own" && current?.source === "hotel" && ignoredLines(hotelText) > 0
              ? `. ${
                  ignoredLines(hotelText) === 1
                    ? t("1 line ignored: only the first 10 are used")
                    : t("{n} lines ignored: only the first 10 are used", { n: ignoredLines(hotelText) })
                }`
              : ""}
            {`. ${t("Red: struck for this guest. Green: added for this guest.")}`}
          </p>

          {!current ? (
            <div aria-busy="true" aria-label={t("Loading")}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          ) : tab === "default" ? (
            <BeforeAfter r={current} />
          ) : (
            <>
              {current.changed === 0 && (
                <p className="ask">
                  {t(
                    "Nothing changed for this guest: no entry on this list is outside the guest's top 50 taste matches, or there is no new match to put in its place.",
                  )}
                </p>
              )}
              <EditedList r={current} rejected={rej} toggle={toggle} open={open} setOpen={setOpen} />
            </>
          )}

          {current && (
            <div className="foot noprint">
              <span className="share">
                {(tab === "g1" || tab === "g2" || tab === "default") && shareCount !== null
                  ? t("Guest 1 and Guest 2 share {n} of {m}", { n: shareCount, m: g1!.length })
                  : ""}
              </span>
              {tab === "default" && (
                <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => {
                      setHotelOpen(true);
                      choose("own");
                    }}
                  >
                    {t("Use your hotel's own list")}
                  </button>
                  <button className="btn" type="button" onClick={() => choose("g1")}>
                    {t("Every reason for Guest 1 →")}
                  </button>
                </span>
              )}
              {tab !== "default" && (
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <small className="label" style={{ margin: 0 }}>{t("Accept / reject stays on this screen only.")}</small>
                  <button className="btn" type="button" onClick={() => setSendOpen((s) => !s)}>
                    {t("Message for the guest")}
                  </button>
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {sendOpen && current && tab !== "default" && <SendOut r={current} rejected={rej} />}

      <p className="label noprint" style={{ marginTop: 18 }} hidden={tab === "arrivals"}>
        {t(LABEL)}{" "}
        {t(
          "Notes name the guest's favourite that Qloo's explainability says drove the place, then the place's own Qloo tags; the bar is the guest's Qloo taste affinity for it.",
        )}{" "}
        <Link href="/how">{t("How this works")}</Link>
      </p>
    </main>
  );
}

// The first screen: the list every guest gets, and the same list in red pen for Guest 1, no click needed.
function BeforeAfter({ r }: { r: EditResult }) {
  const t = useT();
  return (
    <div className="ba">
      <div>
        <h3>{t("The hotel's list")}</h3>
        <span className="for">{t("every guest")}</span>
        <ol className="list compact">
          {r.default.map((p, i) => (
            <li className="row" key={p.id}>
              <span className="num">{i + 1}</span>
              <div className="place">
                <div className="name">{p.name}</div>
                <div className="meta">{meta(p, t)}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h3>{t("For Guest 1")}</h3>
        <span className="for">{t("loves {names}", { names: guestName(r.guest) })}</span>
        <ol className="list compact">
          {r.lines.map((l) => (
            <li className={`row ${l.status}`} key={`${l.status}-${l.place.id}`}>
              <span className="num">{l.status === "insert" ? "+" : ""}</span>
              <div className="place">
                <div className="name">{l.place.name}</div>
                {l.status === "insert" && <div className="cnote">{l.note}</div>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function SideBySide({
  a,
  b,
  ra,
  rb,
  share,
}: {
  a: EditResult;
  b: EditResult;
  ra: Set<string>;
  rb: Set<string>;
  share: number;
}) {
  const t = useT();
  const fa = finalList(a, ra);
  const fb = finalList(b, rb);
  const inB = new Set(fb.map((p) => p.id));
  const inA = new Set(fa.map((p) => p.id));
  const col = (r: EditResult, list: Place[], other: Set<string>, title: string) => {
    const added = new Set(r.lines.filter((l) => l.status === "insert").map((l) => l.place.id));
    const notes = new Map(r.lines.filter((l) => l.status === "insert").map((l) => [l.place.id, l.note]));
    return (
      <div className="col">
        <h3>{title}</h3>
        <span className="for">{t("loves {names}", { names: guestName(r.guest) })}</span>
        <ol className="list compact">
          {list.map((p, i) => (
            <li key={p.id} className={`row ${added.has(p.id) ? "insert" : ""}`}>
              <span className="num">{i + 1}</span>
              <div className="place">
                <div className="name">{p.name}</div>
                <MapLink p={p} city={r.city} />
                <div className="meta">{other.has(p.id) ? t("on both lists") : meta(p, t)}</div>
                {added.has(p.id) && notes.get(p.id) && <div className="cnote">{notes.get(p.id)}</div>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  };
  return (
    <section className="sheet animate" aria-label={t("Guest 1 and Guest 2 side by side")}>
      <div className="sheet-head">
        <h2>{t("Same hotel in {city}, two guests", { city: a.city })}</h2>
        <span className="share">{t("Guest 1 and Guest 2 share {n} of {m}", { n: share, m: a.length })}</span>
      </div>
      <p className="label">
        {t("Green: added for that guest. Each list as the guest would get it (rejected changes undone).")}
      </p>
      <div className="cols">
        {col(a, fa, inB, t("Guest 1"))}
        {col(b, fb, inA, t("Guest 2"))}
      </div>
    </section>
  );
}

function TabButton({ id, tab, choose, kicker, title }: { id: Tab; tab: Tab; choose: (t: Tab) => void; kicker: string; title: string }) {
  return (
    <button type="button" role="tab" aria-selected={tab === id} className="tab" onClick={() => choose(id)}>
      <small>{kicker}</small>
      <span>{title}</span>
    </button>
  );
}

function EditedList({
  r,
  rejected,
  toggle,
  open,
  setOpen,
}: {
  r: EditResult;
  rejected: Set<string>;
  toggle: (strikeId: string, reject: boolean) => void;
  open: string | null;
  setOpen: (id: string | null) => void;
}) {
  const t = useT();
  const numbers: number[] = [];
  const order: number[] = [];
  r.lines.forEach((l, i) => {
    numbers.push((numbers[i - 1] ?? 0) + (l.status === "insert" ? 0 : 1));
    order.push((order[i - 1] ?? -1) + (l.status === "keep" ? 0 : 1));
  });
  return (
    <ol className="list">
      {r.lines.map((l, i) => {
        const strikeId = l.status === "strike" ? l.place.id : l.replaces ?? "";
        const isRejected = l.status !== "keep" && rejected.has(strikeId);
        const cls = ["row", l.status, isRejected ? (l.status === "strike" ? "restored" : "rejected") : ""].join(" ");
        const key = `${l.status}-${l.place.id}`;
        const delay = l.status === "keep" ? undefined : { animationDelay: `${40 + order[i] * 45}ms` };
        return (
          <li className={cls} key={key} style={delay}>
            <span className="num">{l.status === "insert" ? "+" : numbers[i]}</span>
            <div className="place">
              <div className="name">{l.place.name}</div>
              <MapLink p={l.place} city={r.city} />
              <div className="meta">{meta(l.place, t)}</div>
            </div>
            {l.status === "keep" ? (
              <span />
            ) : (
              <div className="note">
                <button type="button" className="why" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>
                  {l.note}
                </button>
                <Affinity value={l.affinity} />
                {l.status === "strike" && (
                  <div className="decide">
                    <button type="button" aria-pressed={!isRejected} onClick={() => toggle(strikeId, false)}>
                      {t("Accept")}
                    </button>
                    <button type="button" aria-pressed={isRejected} onClick={() => toggle(strikeId, true)}>
                      {t("Reject")}
                    </button>
                  </div>
                )}
              </div>
            )}
            {open === key && <Detail line={l} r={r} />}
          </li>
        );
      })}
    </ol>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function Detail({ line, r }: { line: Line; r: EditResult }) {
  const t = useT();
  const lang = useLang();
  const p = line.place;
  const rank = line.status === "strike" ? (line.why as unknown as AffinityRank[] | undefined)?.[0] : undefined;
  if (line.status === "strike") {
    return (
      <div className="detail">
        <p>
          {t(
            "Qloo ranked {n} places in {city} for a guest who loves {names}. {place} is not among them, so it made room for a closer match.",
            { n: r.match_count, city: r.city, names: guestName(r.guest), place: p.name },
          )}
        </p>
        {rank && (
          <p>
            {rank.rank_from_bottom === 1
              ? t("Of the {of} places on this list, it has the lowest taste affinity for this guest in Qloo.", { of: rank.of })
              : t("Of the {of} places on this list, it has the {nth} lowest taste affinity for this guest in Qloo.", {
                  of: rank.of,
                  nth:
                    lang === "de"
                      ? `${rank.rank_from_bottom}.`
                      : lang === "fr"
                        ? `${rank.rank_from_bottom}e`
                        : ordinal(rank.rank_from_bottom),
                })}
          </p>
        )}
        <p className="src">{t("It stays on the default list for other guests. Reject the change to keep it here.")}</p>
      </div>
    );
  }
  const why = line.why ?? [];
  return (
    <div className="detail">
      {why.length > 0 && (
        <p>
          <strong>{t("Driven most by {name}", { name: why[0].name })}</strong>
          {why.length > 1 ? t(", then {names}", { names: why.slice(1).map((w) => w.name).join(", ") }) : ""}.
        </p>
      )}
      <p>
        {[p.kind, p.neighborhood, p.address].filter(Boolean).join(" · ")}
        {p.price_level ? ` · ${"$".repeat(Math.min(4, p.price_level))}` : ""}
      </p>
      {p.description && <p>“{p.description}” <span className="src">{t("(Qloo place description)")}</span></p>}
      <p className="src">
        {t("Source: Qloo Insights with explainability for this guest's favourites.")} {t(LABEL)}
      </p>
    </div>
  );
}

type Channel = "whatsapp" | "email";

// The guest's message, written per language (a French guest can get French from an English desk).
const MESSAGE: Record<Lang, {
  dear: (n: string) => string;
  welcome: (hotel: string, city: string, when: string, what: string) => string;
  what: Record<string, string>;
  guest: string;
  ourHotel: string;
  ask: string;
  regards: string;
  team: string;
  subject: (city: string, hotel: string) => string;
}> = {
  en: {
    dear: (n) => `Dear ${n},`,
    welcome: (h, c, w, x) => `Welcome to ${h}. For your stay in ${c}${w ? ` from ${w}` : ""} we have picked a few ${x} we think you will enjoy:`,
    what: { dining: "restaurants and bars", nightlife: "places for live music and a night out", museums: "museums and galleries" },
    guest: "guest",
    ourHotel: "our hotel",
    ask: "Just let us know if you would like us to book or arrange anything.",
    regards: "Kind regards,",
    team: "The concierge team",
    subject: (c, h) => `Your ${c} picks from ${h}`,
  },
  de: {
    dear: (n) => `Guten Tag ${n},`,
    welcome: (h, c, w, x) => `willkommen ${h === "unserem Hotel" ? "in unserem Hotel" : `im ${h}`}. Für Ihren Aufenthalt in ${c}${w ? ` ab dem ${w}` : ""} haben wir einige ${x} ausgewählt, die Ihnen gefallen dürften:`,
    what: { dining: "Restaurants und Bars", nightlife: "Orte für Livemusik und einen Abend in der Stadt", museums: "Museen und Galerien" },
    guest: "lieber Gast",
    ourHotel: "unserem Hotel",
    ask: "Sagen Sie uns gern Bescheid, wenn wir etwas für Sie reservieren oder organisieren dürfen.",
    regards: "Mit freundlichen Grüßen",
    team: "Ihr Concierge-Team",
    subject: (c, h) => `Ihre Empfehlungen für ${c} von ${h}`,
  },
  fr: {
    dear: (n) => `Bonjour ${n},`,
    welcome: (h, c, w, x) => `bienvenue à ${h}. Pour votre séjour à ${c}${w ? ` à partir du ${w}` : ""}, nous avons choisi quelques ${x} qui devraient vous plaire :`,
    what: { dining: "restaurants et bars", nightlife: "lieux de musique live et de sortie", museums: "musées et galeries" },
    guest: "cher client",
    ourHotel: "notre hôtel",
    ask: "N’hésitez pas à nous demander si vous souhaitez que nous réservions ou organisions quoi que ce soit.",
    regards: "Bien cordialement,",
    team: "L’équipe de conciergerie",
    subject: (c, h) => `Vos adresses à ${c}, de la part de ${h}`,
  },
};

function stayDate(iso: string, lang: Lang): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(LOCALE[lang], { day: "numeric", month: "long", year: "numeric" });
}

function guestMessage(
  r: EditResult,
  rejected: Set<string>,
  f: { guest: string; hotel: string; date: string; lang: Lang },
  channel: Channel,
): string {
  const m = MESSAGE[f.lang];
  const bold = (x: string) => (channel === "whatsapp" ? `*${x}*` : x);
  const rows = finalList(r, rejected).map((p, i) => {
    const about = [p.neighborhood, ...(p.tags ?? []).slice(0, 2)].filter(Boolean).join(", ");
    const link = p.in_qloo === false || p.in_house ? "" : `\n   ${mapsUrl(p, r.city)}`;
    return `${i + 1}. ${bold(p.name)}${about ? ` (${about})` : ""}${link}`;
  });
  const hotel = f.hotel.trim() || m.ourHotel;
  const body = [
    m.dear(f.guest.trim() || m.guest),
    "",
    m.welcome(hotel, r.city, stayDate(f.date, f.lang), m.what[r.category ?? "dining"] ?? m.what.dining),
    "",
    ...rows,
    "",
    m.ask,
    "",
    m.regards,
    f.hotel.trim() ? `${m.team}, ${hotel}` : m.team,
  ].join("\n");
  return channel === "email" ? `${translate(f.lang, "Subject")}: ${m.subject(r.city, hotel)}\n\n${body}` : body;
}

function SendOut({ r, rejected }: { r: EditResult; rejected: Set<string> }) {
  const t = useT();
  const ui = useLang();
  const [f, setF] = useState({ guest: "", hotel: "", date: new Date().toISOString().slice(0, 10), lang: ui });
  const [copied, setCopied] = useState<Channel | null>(null);
  const text = guestMessage(r, rejected, f, "whatsapp").replace(/\*/g, "");
  const copy = (c: Channel) => navigator.clipboard?.writeText(guestMessage(r, rejected, f, c)).then(() => setCopied(c));
  const set = (patch: Partial<typeof f>) => {
    setCopied(null);
    setF({ ...f, ...patch });
  };
  return (
    <section className="sheet sendout" aria-label={t("Message for the guest")}>
      <div className="sheet-head noprint">
        <h2>{t("Message for the guest")}</h2>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn ghost" type="button" onClick={() => copy("whatsapp")}>
            {copied === "whatsapp" ? t("Copied") : t("Copy for WhatsApp")}
          </button>
          <button className="btn ghost" type="button" onClick={() => copy("email")}>
            {copied === "email" ? t("Copied") : t("Copy for email")}
          </button>
          <button className="btn" type="button" onClick={() => window.print()}>
            {t("Print")}
          </button>
        </span>
      </div>
      <div className="fields noprint">
        <label className="label">
          {t("Guest")}
          <input value={f.guest} placeholder="Ms Patel" maxLength={60} onChange={(e) => set({ guest: e.target.value })} />
        </label>
        <label className="label">
          {t("Hotel")}
          <input value={f.hotel} placeholder="The Hotel" maxLength={60} onChange={(e) => set({ hotel: e.target.value })} />
        </label>
        <label className="label">
          {t("Arrival")}
          <input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <label className="label">
          {t("Guest's language")}
          <select value={f.lang} onChange={(e) => set({ lang: e.target.value as Lang })}>
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <pre lang={f.lang}>{text}</pre>
      <p className="label noprint">{t("Nothing is sent from here: copy the text into WhatsApp or your email, or print it.")}</p>
    </section>
  );
}

function OwnGuest({
  start,
  budget,
  hotelOpen,
  hotelText,
  setHotelText,
  onStart,
  onResult,
}: {
  start: StartState["own"];
  budget: number;
  hotelOpen: boolean;
  hotelText: string;
  setHotelText: (v: string) => void;
  onStart: () => void;
  onResult: (r: EditResult) => void;
}) {
  const lang = useLang();
  const t = useT();
  const [city, setCity] = useState(start.city && CITIES.includes(start.city) ? start.city : "London");
  const [category, setCategory] = useState<Category>(start.category);
  const [names, setNames] = useState([0, 1, 2].map((i) => start.favs[i] ?? ""));
  const [ids, setIds] = useState<(string | undefined)[]>([0, 1, 2].map((i) => start.ids[i] || undefined));
  const [issues, setIssues] = useState<Issue[]>([]);
  const [busy, setBusy] = useState<"form" | "agent" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [agent, setAgent] = useState<{ said?: string; trace?: TraceStep[]; other?: string[] } | null>(null);
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [slow, setSlow] = useState(false);
  const inFlight = useRef(false);  // a second click before React re-renders must not send twice

  const hotelLines = useCallback(
    () =>
      hotelText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 10),
    [hotelText],
  );

  const submit = useCallback(
    async (n = names, chosen = ids) => {
      const interests = n
        .map((name, i) => ({ name: name.trim(), id: chosen[i] }))
        .filter((x) => x.name.length >= 2);
      if (!interests.length) {
        setErr(t("Type at least one favourite: a band, show, film, brand or game."));
        return;
      }
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy("form");
      setErr(null);
      setIssues([]);
      setAgent(null);
      onStart();
      try {
        const r = await api.edit(city, interests, budget, hotelLines(), category, lang);
        if (r.status === "ok") onResult(r);
        else setIssues((r as NeedsInput).issues);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        inFlight.current = false;
        setBusy(null);
      }
    },
    [names, ids, city, budget, hotelLines, category, onStart, onResult, lang, t],
  );

  const linked = useRef(start.favs.length > 0);
  useEffect(() => {
    if (!linked.current) return;
    linked.current = false;
    const t = setTimeout(() => submit(), 0);  // a link with favourites opens on their edited list
    return () => clearTimeout(t);
  }, [submit]);

  const runAgent = async () => {
    if (text.trim().length < 3) {
      setErr(t("Describe the guest first, e.g. “loves Amy Winehouse and Dr. Martens”."));
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("agent");
    onStart();
    setErr(null);
    setIssues([]);
    setAgent(null);
    setSteps([]);
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), 30000);
    try {
      const lines = hotelLines();
      const r = await agentStream(
        { text, city, budget, hotel_list: lines.length ? lines : undefined, lang },
        (s) => setSteps((x) => [...x, s]),
      );
      setAgent({ said: r.agent_said, trace: r.trace, other: (r as EditResult).not_considered });
      if (r.city && CITIES.includes(r.city)) setCity(r.city);
      if (r.status === "ok") {
        const ok = r as EditResult;
        setNames([0, 1, 2].map((i) => ok.guest[i]?.name ?? ""));
        setIds([0, 1, 2].map((i) => ok.guest[i]?.id));
        onResult(ok);
      } else if (r.status === "needs_input") {
        const ni = r as NeedsInput;
        // Hand the open question to the form: resolved names stay, the unclear one waits for a pick.
        const n = ["", "", ""];
        const chosen: (string | undefined)[] = [undefined, undefined, undefined];
        ni.resolved.slice(0, 3).forEach((x, i) => {
          n[i] = x.name;
          chosen[i] = x.id;
        });
        const remapped = ni.issues.map((iss, k) => {
          const slot = Math.min(2, ni.resolved.length + k);
          n[slot] = iss.query;
          return { ...iss, field: `interest:${slot}` };
        });
        setNames(n);
        setIds(chosen);
        setIssues(remapped);
      } else setErr(t("The agent couldn't finish. Use the fields above instead."));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
      setSteps([]);
      setSlow(false);
      setBusy(null);
    }
  };

  // The guest meant something Qloo's search didn't offer: clear that field and say how to retry.
  const noneOfThese = (field: string, query: string) => {
    const i = Number(field.split(":")[1] ?? 0);
    const n = [...names];
    const c = [...ids];
    n[i] = "";
    c[i] = undefined;
    setNames(n);
    setIds(c);
    setIssues((all) => all.filter((x) => x.field !== field));
    setErr(
      t("Qloo's search has no other match for ‘{query}’. Try the full name as the brand or artist writes it (e.g. “Dr. Martens”).", {
        query,
      }),
    );
  };

  const pick = (field: string, id: string, name: string) => {
    const i = Number(field.split(":")[1] ?? 0);
    const n = [...names];
    const c = [...ids];
    n[i] = name;
    c[i] = id;
    setNames(n);
    setIds(c);
    submit(n, c);
  };

  return (
    <section className="sheet own noprint" aria-label={t("Your guest")}>
      <details className="hotel-list" open={hotelOpen || hotelText.length > 0}>
        <summary>{t("Use your hotel's own list (optional)")}</summary>
        <div className="fields">
          <textarea
            aria-label={t("Your hotel's list, one place per line")}
            placeholder={t("One restaurant or bar per line, up to 10.\nLeave empty to use the city's default list.")}
            value={hotelText}
            rows={6}
            onChange={(e) => setHotelText(e.target.value)}
          />
          <button
            className="btn ghost"
            type="button"
            onClick={() => setHotelText((SAMPLE_LISTS[city] ?? []).join("\n"))}
          >
            {t("Sample {city} list", { city })}
          </button>
        </div>
        <small className="label">
          {t(
            "Each line is matched to a restaurant or bar in Qloo within 25 km of {city}. Lines it can't match stay on the list, marked “not matched”.",
            { city },
          )}
          {hotelText.split("\n").filter((l) => l.trim()).length > 10 && ` ${t("Only the first 10 lines are used.")}`}
        </small>
      </details>
      <div className="fields">
        <span className="seg" role="group" aria-label={t("What to edit")}>
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => {
                if (c.id !== category) onStart();  // the old list was for the other kind of place
                setCategory(c.id);
              }}>
              {t(c.label)}
            </button>
          ))}
        </span>
        {category !== "dining" && (
          <small className="label" style={{ margin: 0 }}>
            {t("The agent below always edits restaurants & bars.")}
          </small>
        )}
      </div>
      <div className="fields">
        <label className="label" style={{ display: "grid", gap: 4, margin: 0 }}>
          {t("Hotel city")}
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {names.map((v, i) => (
          <input
            key={i}
            aria-label={t("Favourite {n}", { n: i + 1 })}
            placeholder={t("e.g. {x}", { x: ["Arctic Monkeys", "Succession", "Aesop"][i] })}
            value={v}
            maxLength={120}
            onChange={(e) => {
              const n = [...names];
              n[i] = e.target.value;
              setNames(n);
              const c = [...ids];
              c[i] = undefined;
              setIds(c);
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        ))}
        <button className="btn" type="button" disabled={busy !== null} onClick={() => submit()}>
          {busy === "form" ? t("Editing…") : t("Edit the list")}
        </button>
      </div>
      <div className="or">{t("or describe the guest to the agent")}</div>
      <div className="fields">
        <textarea
          aria-label={t("Describe the guest")}
          placeholder="Guest checking in tonight: loves Amy Winehouse and Dr. Martens"
          value={text}
          maxLength={400}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn ghost" type="button" disabled={busy !== null} onClick={runAgent}>
          {busy === "agent" ? t("Agent is working…") : t("Ask the agent")}
        </button>
      </div>
      {issues.map((iss) =>
        iss.kind === "clarify" ? (
          <div className="ask" key={iss.field}>
            {t("{n} matches for ‘{q}’. Which one do you mean?", { n: iss.options.length, q: iss.query })}
            <div className="opts">
              {iss.options.map((o) => (
                <button key={o.id} type="button" title={o.description} onClick={() => pick(iss.field, o.id, o.name)}>
                  {o.name} <span className="label">({optionKind(o)})</span>
                  {o.description && <span className="opt-desc">{o.description.slice(0, 60)}{o.description.length > 60 ? "…" : ""}</span>}
                </button>
              ))}
              <button type="button" className="none" onClick={() => noneOfThese(iss.field, iss.query)}>
                {t("None of these")}
              </button>
            </div>
          </div>
        ) : (
          <div className="ask" key={iss.field}>
            ‘{iss.query}’: {t(iss.message)}
          </div>
        ),
      )}
      {busy === "agent" && (
        <div className="live" aria-live="polite">
          <p className="label">{t("The agent is working. Each tool call appears as it happens:")}</p>
          <ol>
            {steps.map((s, i) => (
              <li key={i}>
                <code>{s.tool}</code> {typeof s.input === "string" ? s.input : JSON.stringify(s.input)} →{" "}
                {typeof s.output === "string" ? s.output : JSON.stringify(s.output)}
              </li>
            ))}
            {steps.length === 0 && <li className="label">{t("Reading the description…")}</li>}
          </ol>
          {slow && (
            <p className="err">
              {t(
                "This is taking longer than usual (30 s). The agent stops after about 50 s; the fields above give the same list without the model.",
              )}
            </p>
          )}
        </div>
      )}
      {err && <p className="err">{err}</p>}
      {agent?.said && <p className="agent-said">{t("Agent: {text}", { text: agent.said })}</p>}
      {agent?.other && agent.other.length > 0 && (
        <p className="other">{t("Not considered by the edit: {list}", { list: agent.other.join(", ") })}</p>
      )}
      {agent?.trace && agent.trace.length > 0 && (
        <details className="trace">
          <summary>{t("What the agent did ({n} tool calls)", { n: agent.trace.length })}</summary>
          <ol>
            {agent.trace.map((s, i) => (
              <li key={i}>
                <code>{s.tool}</code> {typeof s.input === "string" ? s.input : JSON.stringify(s.input)} →{" "}
                {typeof s.output === "string" ? s.output : JSON.stringify(s.output)}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

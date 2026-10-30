"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  BUDGETS,
  CITIES,
  DEFAULT_LABEL,
  HOTEL_LABEL,
  SAMPLE_LISTS,
  finalList,
  guestName,
  LABEL,
  shared,
  type DemoPair,
  type Issue,
  type Line,
  type NeedsInput,
  type Place,
  type Redline as RedlineResult,
  type TraceStep,
} from "@/lib/api";

type Tab = "default" | "g1" | "g2" | "both" | "own";

function meta(p: Place): string {
  if (p.in_qloo === false) return "Not matched to a restaurant or bar in Qloo · kept as is";
  const base = [p.kind, p.neighborhood].filter(Boolean).join(" · ");
  if (p.typed) return `${base} · listed as “${p.typed}”`;
  return base;
}

function pairLabel(p: DemoPair): string {
  return `${p.city}: ${guestName(p.guest1)} vs. ${guestName(p.guest2)}`;
}

export default function Redline() {
  const [pairs, setPairs] = useState<DemoPair[]>([]);
  const [pairIdx, setPairIdx] = useState(0);
  const [budget, setBudget] = useState(5);
  const [tab, setTab] = useState<Tab>("default");
  const [results, setResults] = useState<Partial<Record<Tab, RedlineResult>>>({});
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [rejected, setRejected] = useState<Partial<Record<Tab, Set<string>>>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [animate, setAnimate] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const touched = useRef(false);

  const pair = pairs[pairIdx];

  useEffect(() => {
    api.demo().then((d) => setPairs(d.pairs)).catch((e) => setError(e.message));
  }, []);

  // Load both demo guests whenever the example or the swap budget changes (or on "Try again").
  useEffect(() => {
    if (!pair) return;
    let live = true;
    const load = (key: "g1" | "g2", g: typeof pair.guest1) =>
      api
        .redline(pair.city, g.map((x) => ({ name: x.name, id: x.id })), budget)
        .then((res) => {
          if (!live) return;
          if (res.status === "ok") setResults((r) => ({ ...r, [key]: res }));
          else setError("This example needs a pick first. Try another example.");
        })
        .catch((e) => live && setError(e.message));
    load("g1", pair.guest1);
    load("g2", pair.guest2);
    return () => {
      live = false;
    };
  }, [pair, budget, attempt]);

  // The first visit shows the hotel's list, then Guest 1 checks in by themselves.
  useEffect(() => {
    if (!results.g1 || touched.current) return;
    const t = setTimeout(() => {
      if (touched.current) return;
      touched.current = true;
      setAnimate(true);
      setTab("g1");
    }, 2600);
    return () => clearTimeout(t);
  }, [results.g1]);

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

  const current = tab === "default" ? results.g1 : tab === "both" ? undefined : results[tab];
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
      <header className="top noprint">
        <div>
          <h1 className="brand">
            <span className="r">Red</span>line
          </h1>
          <p className="lede">Every hotel guest gets the same list. Redline edits it for each guest.</p>
        </div>
        <nav className="toplinks">
          <Link href="/how">How this works</Link>
          <a href="https://github.com/millerandmuller/redline">Code</a>
        </nav>
      </header>

      <div className="controls noprint">
        <label>
          Example
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
                {pairLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <span className="ctl">
          Swap budget
          <span className="seg" role="group" aria-label="Swap budget">
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

      <div className="tabs noprint" role="tablist" aria-label="Whose list">
        <TabButton id="default" tab={tab} choose={choose} kicker={pair ? `Hotel in ${pair.city}` : "Hotel"} title="Default list" />
        <TabButton id="g1" tab={tab} choose={choose} kicker="Guest 1 checks in" title={pair ? guestName(pair.guest1) : "…"} />
        <TabButton id="g2" tab={tab} choose={choose} kicker="Guest 2, same hotel" title={pair ? guestName(pair.guest2) : "…"} />
        <TabButton id="both" tab={tab} choose={choose} kicker="Compare" title="Guest 1 | Guest 2" />
        <TabButton id="own" tab={tab} choose={choose} kicker="Try your own" title="Your guest (and list)" />
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
            Try again
          </button>
        </p>
      )}

      {tab === "own" && (
        <OwnGuest
          budget={budget}
          onStart={() => setResults((x) => ({ ...x, own: undefined }))}
          onResult={(r) => {
            setAnimate(true);
            setResults((x) => ({ ...x, own: r }));
            setRejected((x) => ({ ...x, own: new Set() }));
            setOpen(null);
          }}
        />
      )}

      {tab === "both" && g1 && g2 && (
        <SideBySide a={g1} b={g2} ra={rejected.g1 ?? none} rb={rejected.g2 ?? none} share={shareCount ?? 0} />
      )}

      {tab !== "both" && (tab !== "own" || results.own) && (
        <section className={`sheet${animate ? " animate" : ""}`} key={`${tab}-${current?.city}-${current?.budget}-${guestName(current?.guest ?? [])}`}>
          <div className="sheet-head">
            <div>
              <h2>Restaurants &amp; bars{current ? ` in ${current.city}` : ""}</h2>
              <span className="for">
                {tab === "default" || !current
                  ? "For every guest"
                  : `For a guest who loves ${current.guest.map((g) => (g.kind ? `${g.name} (${g.kind.replace("_", " ")})` : g.name)).join(" + ")}`}
              </span>
            </div>
            <div>
              {current?.cached && <span className="badge" title="Answered from saved Qloo results">cached result</span>}{" "}
              {current && tab === "own" && <span className="badge">swap budget {current.budget}</span>}{" "}
              {current && tab !== "default" && (
                <span className="count">
                  <span className="red">{current.changed - [...rej].length}</span> of {current.length} changed
                </span>
              )}
            </div>
          </div>
          <p className="label">
            {current?.source === "hotel" ? HOTEL_LABEL : DEFAULT_LABEL}
            {current?.skipped?.length ? `. Skipped as repeats: ${current.skipped.join(", ")}` : ""}
            {tab === "default" ? "" : ". Red: struck for this guest. Green: added for this guest."}
          </p>

          {!current ? (
            <div aria-busy="true" aria-label="Loading">
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          ) : tab === "default" ? (
            <ol className="list">
              {current.default.map((p, i) => (
                <li className="row" key={p.id}>
                  <span className="num">{i + 1}</span>
                  <div className="place">
                    <div className="name">{p.name}</div>
                    <div className="meta">{meta(p)}</div>
                  </div>
                  <span />
                </li>
              ))}
            </ol>
          ) : (
            <RedlineList r={current} rejected={rej} toggle={toggle} open={open} setOpen={setOpen} />
          )}

          {current && (
            <div className="foot noprint">
              <span className="share">
                {(tab === "g1" || tab === "g2" || tab === "default") && shareCount !== null
                  ? `Guest 1 and Guest 2 share ${shareCount} of ${g1!.length}`
                  : ""}
              </span>
              {tab !== "default" && (
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <small className="label" style={{ margin: 0 }}>Accept / reject stays on this screen only.</small>
                  <button className="btn" type="button" onClick={() => setSendOpen((s) => !s)}>
                    Send to guest
                  </button>
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {sendOpen && current && tab !== "default" && <SendOut r={current} rejected={rej} />}

      <p className="label noprint" style={{ marginTop: 18 }}>
        {LABEL} Notes name the guest&apos;s favourite that Qloo&apos;s explainability says drove the place.{" "}
        <Link href="/how">How this works</Link>
      </p>
    </main>
  );
}

function SideBySide({
  a,
  b,
  ra,
  rb,
  share,
}: {
  a: RedlineResult;
  b: RedlineResult;
  ra: Set<string>;
  rb: Set<string>;
  share: number;
}) {
  const fa = finalList(a, ra);
  const fb = finalList(b, rb);
  const inB = new Set(fb.map((p) => p.id));
  const inA = new Set(fa.map((p) => p.id));
  const col = (r: RedlineResult, list: Place[], other: Set<string>, title: string) => {
    const added = new Set(r.lines.filter((l) => l.status === "insert").map((l) => l.place.id));
    return (
      <div className="col">
        <h3>{title}</h3>
        <span className="for">loves {guestName(r.guest)}</span>
        <ol className="list compact">
          {list.map((p, i) => (
            <li key={p.id} className={`row ${added.has(p.id) ? "insert" : ""}`}>
              <span className="num">{i + 1}</span>
              <div className="place">
                <div className="name">{p.name}</div>
                <div className="meta">{other.has(p.id) ? "on both lists" : meta(p)}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  };
  return (
    <section className="sheet animate" aria-label="Guest 1 and Guest 2 side by side">
      <div className="sheet-head">
        <h2>Same hotel in {a.city}, two guests</h2>
        <span className="share">
          Guest 1 and Guest 2 share {share} of {a.length}
        </span>
      </div>
      <p className="label">Green: added for that guest. Each list as the guest would get it (rejected changes undone).</p>
      <div className="cols">
        {col(a, fa, inB, "Guest 1")}
        {col(b, fb, inA, "Guest 2")}
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

function RedlineList({
  r,
  rejected,
  toggle,
  open,
  setOpen,
}: {
  r: RedlineResult;
  rejected: Set<string>;
  toggle: (strikeId: string, reject: boolean) => void;
  open: string | null;
  setOpen: (id: string | null) => void;
}) {
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
        const delay = l.status === "keep" ? undefined : { animationDelay: `${150 + order[i] * 160}ms` };
        return (
          <li className={cls} key={key} style={delay}>
            <span className="num">{l.status === "insert" ? "+" : numbers[i]}</span>
            <div className="place">
              <div className="name">{l.place.name}</div>
              <div className="meta">{meta(l.place)}</div>
            </div>
            {l.status === "keep" ? (
              <span />
            ) : (
              <div className="note">
                <button type="button" className="why" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>
                  {l.note}
                </button>
                {l.status === "strike" && (
                  <div className="decide">
                    <button type="button" aria-pressed={!isRejected} onClick={() => toggle(strikeId, false)}>
                      Accept
                    </button>
                    <button type="button" aria-pressed={isRejected} onClick={() => toggle(strikeId, true)}>
                      Reject
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

function Detail({ line, r }: { line: Line; r: RedlineResult }) {
  const p = line.place;
  if (line.status === "strike") {
    return (
      <div className="detail">
        <p>
          Qloo ranked {r.match_count} places in {r.city} for a guest who loves {guestName(r.guest)}. {p.name} is not
          among them, so it made room for a closer match.
        </p>
        <p className="src">It stays on the default list for other guests. Reject the change to keep it here.</p>
      </div>
    );
  }
  const why = line.why ?? [];
  return (
    <div className="detail">
      {why.length > 0 && (
        <p>
          <strong>Driven most by {why[0].name}</strong>
          {why.length > 1 ? `, then ${why.slice(1).map((w) => w.name).join(", ")}` : ""}.
        </p>
      )}
      <p>
        {[p.kind, p.neighborhood, p.address].filter(Boolean).join(" · ")}
        {p.price_level ? ` · ${"$".repeat(Math.min(4, p.price_level))}` : ""}
      </p>
      {p.description && <p>“{p.description}” <span className="src">(Qloo place description)</span></p>}
      <p className="src">
        Source: Qloo Insights with explainability for this guest&apos;s favourites. {LABEL}
      </p>
    </div>
  );
}

function sendText(r: RedlineResult, rejected: Set<string>): string {
  const notes = new Map<string, string>();
  for (const l of r.lines) if (l.status === "insert" && !rejected.has(l.replaces ?? "")) notes.set(l.place.id, l.note);
  const rows = finalList(r, rejected).map((p, i) => {
    const note = notes.get(p.id);
    const where = [p.kind, p.neighborhood].filter(Boolean).join(" · ");
    return `${i + 1}. ${p.name}${where ? `  (${where})` : ""}${note ? `\n   ${note}` : ""}`;
  });
  return `Picked for you: restaurants & bars in ${r.city}\n\n${rows.join("\n")}\n\nPicks marked with a note were chosen for your taste. ${LABEL}`;
}

function SendOut({ r, rejected }: { r: RedlineResult; rejected: Set<string> }) {
  const text = sendText(r, rejected);
  const [copied, setCopied] = useState(false);
  return (
    <section className="sheet sendout" aria-label="Version for the guest">
      <div className="sheet-head noprint">
        <h2>Send to guest</h2>
        <span style={{ display: "flex", gap: 8 }}>
          <button
            className="btn ghost"
            type="button"
            onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button className="btn" type="button" onClick={() => window.print()}>
            Print
          </button>
        </span>
      </div>
      <pre>{text}</pre>
    </section>
  );
}

function OwnGuest({
  budget,
  onStart,
  onResult,
}: {
  budget: number;
  onStart: () => void;
  onResult: (r: RedlineResult) => void;
}) {
  const [city, setCity] = useState("London");
  const [names, setNames] = useState(["", "", ""]);
  const [ids, setIds] = useState<(string | undefined)[]>([undefined, undefined, undefined]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [busy, setBusy] = useState<"form" | "agent" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [hotelText, setHotelText] = useState("");
  const [agent, setAgent] = useState<{ said?: string; trace?: TraceStep[] } | null>(null);

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
        setErr("Type at least one favourite: a band, show, film, brand or game.");
        return;
      }
      setBusy("form");
      setErr(null);
      setIssues([]);
      setAgent(null);
      onStart();
      try {
        const r = await api.redline(city, interests, budget, hotelLines());
        if (r.status === "ok") onResult(r);
        else setIssues((r as NeedsInput).issues);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [names, ids, city, budget, hotelLines, onStart, onResult],
  );

  const runAgent = async () => {
    if (text.trim().length < 3) return;
    setBusy("agent");
    onStart();
    setErr(null);
    setIssues([]);
    setAgent(null);
    try {
      const r = await api.agent(text, city, budget, hotelLines());
      setAgent({ said: r.agent_said, trace: r.trace });
      if (r.city && CITIES.includes(r.city)) setCity(r.city);
      if (r.status === "ok") {
        const ok = r as RedlineResult;
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
      } else setErr("The agent couldn't finish. Use the fields above instead.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
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
    <section className="sheet own noprint" aria-label="Your guest">
      <details className="hotel-list" open={hotelText.length > 0}>
        <summary>Use your hotel&apos;s own list (optional)</summary>
        <div className="fields">
          <textarea
            aria-label="Your hotel's list, one place per line"
            placeholder={"One restaurant or bar per line, up to 10.\nLeave empty to use the city's default list."}
            value={hotelText}
            rows={6}
            onChange={(e) => setHotelText(e.target.value)}
          />
          <button
            className="btn ghost"
            type="button"
            onClick={() => setHotelText((SAMPLE_LISTS[city] ?? []).join("\n"))}
          >
            Sample {city} list
          </button>
        </div>
        <small className="label">
          Each line is matched to a restaurant or bar in Qloo within 25 km of {city}. Lines it can&apos;t match stay on the list
          unmarked.
          {hotelText.split("\n").filter((l) => l.trim()).length > 10 && " Only the first 10 lines are used."}
        </small>
      </details>
      <div className="fields">
        <label className="label" style={{ display: "grid", gap: 4, margin: 0 }}>
          Hotel city
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {names.map((v, i) => (
          <input
            key={i}
            aria-label={`Favourite ${i + 1}`}
            placeholder={["e.g. Arctic Monkeys", "e.g. Succession", "e.g. Aesop"][i]}
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
          {busy === "form" ? "Editing…" : "Edit the list"}
        </button>
      </div>
      <div className="or">or describe the guest to the agent</div>
      <div className="fields">
        <textarea
          aria-label="Describe the guest"
          placeholder="Guest checking in tonight: loves Amy Winehouse and Dr. Martens"
          value={text}
          maxLength={400}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn ghost" type="button" disabled={busy !== null} onClick={runAgent}>
          {busy === "agent" ? "Agent is working… (10–30 s)" : "Ask the agent"}
        </button>
      </div>
      {issues.map((iss) =>
        iss.kind === "clarify" ? (
          <div className="ask" key={iss.field}>
            {iss.question}
            <div className="opts">
              {iss.options.map((o) => (
                <button key={o.id} type="button" title={o.description} onClick={() => pick(iss.field, o.id, o.name)}>
                  {o.name} <span className="label">({o.kind.replace("_", " ")})</span>
                  {o.description && <span className="opt-desc">{o.description.slice(0, 60)}{o.description.length > 60 ? "…" : ""}</span>}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="ask" key={iss.field}>
            ‘{iss.query}’: {iss.message}
          </div>
        ),
      )}
      {err && <p className="err">{err}</p>}
      {agent?.said && <p className="agent-said">Agent: {agent.said}</p>}
      {agent?.trace && agent.trace.length > 0 && (
        <details className="trace">
          <summary>What the agent did ({agent.trace.length} tool calls)</summary>
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

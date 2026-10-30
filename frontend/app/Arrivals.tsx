"use client";

import { useState } from "react";
import {
  api,
  CITIES,
  guestName,
  LABEL,
  type ArrivalRead,
  type FoundFavourite,
  type Interest,
  type MorningReport,
  type Option,
  type Redline as RedlineResult,
} from "@/lib/api";

const SAMPLE = [
  "Room 204: Ms Patel, 2 nights. Loves Amy Winehouse, always in Dr. Martens. Nut allergy.",
  "Room 310: Mr & Mrs Clarke, anniversary. Big Bridgerton fans, she wears Jo Malone. Late check-out asked.",
  "Room 112: Tom, business trip, rewatching Peaky Blinders, drinks Guinness. Quiet room please.",
  "Room 415: Sophie, here for a concert. Charli XCX superfan, Glossier everything.",
].join("\n");

function parse(text: string): { label: string; text: string }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 3)
    .slice(0, 6)
    .map((l, i) => {
      const cut = l.indexOf(":");
      return cut > 0 && cut <= 30 ? { label: l.slice(0, cut).trim(), text: l.slice(cut + 1).trim() } : { label: `Guest ${i + 1}`, text: l };
    });
}

function reportText(rep: MorningReport): string {
  const parts = rep.guests.map((g) => {
    const r = g.result;
    if (r.status !== "ok") return `${g.label}\n   (no list: ${r.status === "skipped" ? "no favourites confirmed" : "needs a pick"})`;
    const ok = r as RedlineResult;
    const rows = ok.lines.map((l) =>
      l.status === "strike" ? `   - ${l.place.name}` : l.status === "insert" ? `   + ${l.place.name}  (${l.note})` : `     ${l.place.name}`,
    );
    return `${g.label} · loves ${guestName(ok.guest)} · ${ok.changed} of ${ok.length} changed\n${rows.join("\n")}`;
  });
  return `Morning report: tomorrow's arrivals, ${rep.city}\n\n${parts.join("\n\n")}\n\n${LABEL}`;
}

export default function Arrivals({ budget, hotelLines }: { budget: number; hotelLines: string[] }) {
  const [city, setCity] = useState("London");
  const [text, setText] = useState("");
  const [read, setRead] = useState<ArrivalRead | null>(null);
  const [picked, setPicked] = useState<Record<string, Interest | null>>({});
  const [report, setReport] = useState<MorningReport | null>(null);
  const [busy, setBusy] = useState<"read" | "report" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const [adding, setAdding] = useState<Record<number, string>>({});

  const key = (g: number, f: number) => `${g}:${f}`;

  // Without the agent (it failed, or the concierge prefers to type): one card per note, no favourites yet.
  const byHand = (why: string | null) => {
    const notes = parse(text);
    if (!notes.length) {
      setErr("Paste at least one arrival note, one guest per line.");
      return;
    }
    setRead({ status: "ok", guests: notes.map((n) => ({ ...n, favourites: [] })), trace: [] });
    setPicked({});
    setReport(null);
    setManual(why ?? "Add each guest's favourites by hand below.");
  };

  const addFavourite = async (gi: number) => {
    const name = (adding[gi] ?? "").trim();
    if (!read || name.length < 2) return;
    setErr(null);
    try {
      const f: FoundFavourite = await api.resolve(name);
      const fi = read.guests[gi].favourites.length;
      setRead({
        ...read,
        guests: read.guests.map((g, i) => (i === gi ? { ...g, favourites: [...g.favourites, f] } : g)),
      });
      if (f.status === "ok") setPicked((p) => ({ ...p, [key(gi, fi)]: f.entity! }));
      setAdding((a) => ({ ...a, [gi]: "" }));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const readNotes = async () => {
    const notes = parse(text);
    if (!notes.length) {
      setErr("Paste at least one arrival note, one guest per line.");
      return;
    }
    setBusy("read");
    setErr(null);
    setRead(null);
    setReport(null);
    setManual(null);
    try {
      const r = await api.arrivalsRead(notes);
      const p: Record<string, Interest | null> = {};
      r.guests.forEach((g, gi) =>
        g.favourites.forEach((f, fi) => {
          p[key(gi, fi)] = f.status === "ok" ? f.entity! : null;
        }),
      );
      setPicked(p);
      setRead(r);
    } catch (e) {
      byHand(`The agent couldn't read the notes (${(e as Error).message}) Add each guest's favourites by hand below.`);
    } finally {
      setBusy(null);
    }
  };

  const buildReport = async () => {
    if (!read) return;
    setBusy("report");
    setErr(null);
    setCopied(false);
    try {
      const guests = read.guests.map((g, gi) => ({
        label: g.label,
        interests: g.favourites
          .map((_, fi) => picked[key(gi, fi)])
          .filter((x): x is Interest => !!x)
          .map((x) => ({ name: x.name, id: x.id })),
      }));
      setReport(await api.arrivalsReport(city, budget, guests, hotelLines));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (k: string, value: Interest | null) => setPicked((p) => ({ ...p, [k]: p[k]?.id === value?.id ? null : value }));
  const fromOption = (o: Option): Interest => ({ id: o.id, name: o.name, kind: o.kind });

  return (
    <>
      <section className="sheet own noprint" aria-label="Tomorrow's arrivals">
        <div className="sheet-head">
          <h2>Tomorrow&apos;s arrivals</h2>
          <span className="for">One guest per line, as the front desk or CRM wrote it. Up to 6.</span>
        </div>
        <div className="fields">
          <label className="label" style={{ display: "grid", gap: 4, margin: 0 }}>
            Hotel city
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <span className="label" style={{ margin: 0 }}>
            {hotelLines.length ? `Using your hotel's list (${hotelLines.length} lines, from “Your guest”)` : "Using the city's default list"}
            {` · swap budget ${budget}`}
          </span>
        </div>
        <div className="fields">
          <textarea
            aria-label="Arrival notes, one guest per line"
            placeholder={"Room 204: Ms Patel. Loves Amy Winehouse, always in Dr. Martens. Nut allergy."}
            value={text}
            rows={5}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn ghost" type="button" onClick={() => setText(SAMPLE)}>
            Sample arrivals
          </button>
        </div>
        <div className="fields">
          <button className="btn" type="button" disabled={busy !== null} onClick={readNotes}>
            {busy === "read" ? "Agent is reading the notes…" : "1. Read the notes"}
          </button>
          <button className="btn ghost" type="button" disabled={busy !== null} onClick={() => byHand(null)}>
            Skip the agent
          </button>
          <small className="label" style={{ margin: 0 }}>
            The agent only keeps favourites that are written in the note; you confirm them before anything is edited.
          </small>
        </div>

        {read && (
          <div className="confirm">
            {manual && <p className="ask">{manual}</p>}
            {read.guests.map((g, gi) => (
              <div className="guest-card" key={gi}>
                <strong>{g.label}</strong> <span className="label">{g.text}</span>
                <div className="chips">
                  {g.favourites.length === 0 && <span className="label">No band, show, film, brand or game in this note.</span>}
                  {g.favourites.map((f, fi) =>
                    f.status === "ok" ? (
                      <button
                        key={fi}
                        type="button"
                        className="chip"
                        aria-pressed={picked[key(gi, fi)]?.id === f.entity!.id}
                        onClick={() => toggle(key(gi, fi), f.entity!)}
                      >
                        {picked[key(gi, fi)] ? "✓ " : ""}
                        {f.entity!.name} <span className="label">({f.entity!.kind.replace("_", " ")})</span>
                      </button>
                    ) : f.status === "clarify" ? (
                      <span key={fi} className="ask">
                        {f.question}{" "}
                        {f.options!.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            className="chip"
                            aria-pressed={picked[key(gi, fi)]?.id === o.id}
                            onClick={() => toggle(key(gi, fi), fromOption(o))}
                          >
                            {o.name} <span className="label">({o.kind.replace("_", " ")})</span>
                          </button>
                        ))}
                      </span>
                    ) : (
                      <span key={fi} className="label">
                        ‘{f.query}’ not found in Qloo
                      </span>
                    ),
                  )}
                  <input
                    aria-label={`Add a favourite for ${g.label}`}
                    placeholder="Add a favourite"
                    value={adding[gi] ?? ""}
                    maxLength={120}
                    onChange={(e) => setAdding((a) => ({ ...a, [gi]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addFavourite(gi)}
                  />
                  <button type="button" className="chip" onClick={() => addFavourite(gi)}>
                    Add
                  </button>
                </div>
              </div>
            ))}
            <div className="fields">
              <button className="btn" type="button" disabled={busy !== null} onClick={buildReport}>
                {busy === "report" ? "Editing every list…" : "2. Build the morning report"}
              </button>
            </div>
            {read.trace.length > 0 && (
              <details className="trace">
                <summary>What the agent did ({read.trace.length} tool calls)</summary>
                <ol>
                  {read.trace.map((s, i) => (
                    <li key={i}>
                      <code>{s.tool}</code> {String(s.input)} → {JSON.stringify(s.output)}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        )}
        {err && <p className="err">{err}</p>}
      </section>

      {report && (
        <section className="sheet report" aria-label="Morning report">
          <div className="sheet-head">
            <h2>Morning report · {report.city}</h2>
            <span className="noprint" style={{ display: "flex", gap: 8 }}>
              <button
                className="btn ghost"
                type="button"
                onClick={() => navigator.clipboard?.writeText(reportText(report)).then(() => setCopied(true))}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button className="btn" type="button" onClick={() => window.print()}>
                Print
              </button>
            </span>
          </div>
          {report.guests.map((g, i) => {
            const r = g.result;
            if (r.status !== "ok")
              return (
                <div className="report-guest" key={i}>
                  <h3>{g.label}</h3>
                  <p className="label">{r.status === "skipped" ? "No favourites confirmed, so the list stays as it is." : "A favourite needs a pick first."}</p>
                </div>
              );
            const ok = r as RedlineResult;
            return (
              <div className="report-guest" key={i}>
                <h3>
                  {g.label} <span className="for">loves {guestName(ok.guest)}</span>{" "}
                  <span className="count">
                    <span className="red">{ok.changed}</span> of {ok.length} changed
                  </span>
                  {ok.cached && <span className="badge"> cached result</span>}
                </h3>
                <ol className="list compact">
                  {ok.lines.map((l) => (
                    <li key={`${l.status}-${l.place.id}`} className={`row ${l.status}`}>
                      <span className="num">{l.status === "insert" ? "+" : l.status === "strike" ? "−" : "·"}</span>
                      <div className="place">
                        <div className="name">{l.place.name}</div>
                        <div className="meta">
                          {l.status === "insert"
                            ? l.note
                            : l.status === "strike"
                              ? "Not among this guest's top 50 taste matches"
                              : [l.place.kind, l.place.neighborhood].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
          <p className="label">{LABEL} Open “Your guest (and list)” to accept or reject single changes.</p>
        </section>
      )}
    </>
  );
}

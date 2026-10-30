"use client";

import { useRef, useState } from "react";
import { useLang, useT } from "./LangContext";
import type { Vars } from "@/lib/lang";
import {
  api,
  CATEGORIES,
  CITIES,
  categoryLabel,
  type Category,
  guestName,
  LABEL,
  type ArrivalRead,
  type FoundFavourite,
  type Interest,
  type MorningReport,
  type Option,
  optionKind,
  type EditResult,
} from "@/lib/api";

const SAMPLE = [
  "Room 204: Ms Patel, 2 nights. Loves Amy Winehouse, always in Dr. Martens. Nut allergy.",
  "Room 310: Mr & Mrs Clarke, anniversary. Big Bridgerton fans, she wears Jo Malone. Late check-out asked.",
  "Room 112: Tom, business trip, rewatching Peaky Blinders, drinks Guinness. Quiet room please.",
  "Room 415: Sophie, here for a concert. Charli XCX superfan, Glossier everything.",
].join("\n");

function added(r: EditResult): Set<string> {
  return new Set(r.lines.filter((l) => l.status === "insert").map((l) => l.place.id));
}

function extraNotes(text: string): number {
  return Math.max(0, text.split("\n").filter((l) => l.trim().length >= 3).length - 6);
}

type T = (en: string, vars?: Vars) => string;

function parse(text: string, t: T): { label: string; text: string }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 3)
    .slice(0, 6)
    .map((l, i) => {
      const cut = l.indexOf(":");
      return cut > 0 && cut <= 30 ? { label: l.slice(0, cut).trim(), text: l.slice(cut + 1).trim() } : { label: t("Guest {n}", { n: i + 1 }), text: l };
    });
}

function reportText(rep: MorningReport, t: T): string {
  const parts = rep.guests.map((g) => {
    const r = g.result;
    const other = g.not_considered?.length ? `\n   ${t("Not considered: {list}", { list: g.not_considered.join(", ") })}` : "";
    if (r.status !== "ok")
      return `${g.label}${other}\n   ${r.status === "skipped" ? t("(no list: no favourites confirmed)") : t("(no list: needs a pick)")}`;
    const ok = r as EditResult;
    const rows = ok.lines.map((l) =>
      l.status === "strike" ? `   - ${l.place.name}` : l.status === "insert" ? `   + ${l.place.name}  (${l.note})` : `     ${l.place.name}`,
    );
    return `${g.label} · ${t("loves {names}", { names: guestName(ok.guest) })} · ${t("{n} of {m} changed", { n: ok.changed, m: ok.length })}${other}\n${rows.join("\n")}`;
  });
  return `${t("Morning report: tomorrow's arrivals, {city}", { city: rep.city })}\n\n${parts.join("\n\n")}\n\n${t(LABEL)}`;
}

export default function Arrivals({ budget, hotelLines }: { budget: number; hotelLines: string[] }) {
  const lang = useLang();
  const t = useT();
  const [city, setCity] = useState("London");
  const [category, setCategory] = useState<Category>("dining");
  const [text, setText] = useState("");
  const [read, setRead] = useState<ArrivalRead | null>(null);
  const [picked, setPicked] = useState<Record<string, Interest | null>>({});
  const [report, setReport] = useState<MorningReport | null>(null);
  const [busy, setBusy] = useState<"read" | "report" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const [adding, setAdding] = useState<Record<number, string>>({});
  const inFlight = useRef(false);  // a double click must not run the agent twice

  const key = (g: number, f: number) => `${g}:${f}`;

  // Without the agent (it failed, or the concierge prefers to type): one card per note, no favourites yet.
  const byHand = (why: string | null) => {
    const notes = parse(text, t);
    if (!notes.length) {
      setErr(t("Paste at least one arrival note, one guest per line."));
      return;
    }
    setRead({ status: "ok", guests: notes.map((n) => ({ ...n, favourites: [] })), trace: [] });
    setPicked({});
    setReport(null);
    setManual(why ?? t("Add each guest's favourites by hand below."));
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
    const notes = parse(text, t);
    if (!notes.length) {
      setErr(t("Paste at least one arrival note, one guest per line."));
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
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
      byHand(t("The agent couldn't read the notes ({error}) Add each guest's favourites by hand below.", { error: (e as Error).message }));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const buildReport = async () => {
    if (!read || inFlight.current) return;
    inFlight.current = true;
    setBusy("report");
    setErr(null);
    setCopied(false);
    try {
      const guests = read.guests.map((g, gi) => ({
        label: g.label,
        not_considered: g.not_considered ?? [],
        interests: g.favourites
          .map((_, fi) => picked[key(gi, fi)])
          .filter((x): x is Interest => !!x)
          .map((x) => ({ name: x.name, id: x.id })),
      }));
      setReport(await api.arrivalsReport(city, budget, guests, hotelLines, category, lang));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const toggle = (k: string, value: Interest | null) => setPicked((p) => ({ ...p, [k]: p[k]?.id === value?.id ? null : value }));
  const fromOption = (o: Option): Interest => ({ id: o.id, name: o.name, kind: o.kind });

  return (
    <>
      <section className="sheet own noprint" aria-label={t("Tomorrow's arrivals")}>
        <div className="sheet-head">
          <h2>{t("Tomorrow's arrivals")}</h2>
          <span className="for">{t("One guest per line, as the front desk or CRM wrote it. Up to 6.")}</span>
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
          <span className="seg" role="group" aria-label={t("What to edit")}>
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
                {t(c.label)}
              </button>
            ))}
          </span>
          <span className="label" style={{ margin: 0 }}>
            {hotelLines.length
              ? t("Using your hotel's list ({n} lines, from “Your guest”)", { n: hotelLines.length })
              : t("Using the city's default list")}
            {` · ${t("up to {n} lines change", { n: budget })}`}
          </span>
        </div>
        <div className="fields">
          <textarea
            aria-label={t("Arrival notes, one guest per line")}
            placeholder={"Room 204: Ms Patel. Loves Amy Winehouse, always in Dr. Martens. Nut allergy."}
            value={text}
            rows={5}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn ghost" type="button" onClick={() => setText(SAMPLE)}>
            {t("Sample arrivals")}
          </button>
        </div>
        {extraNotes(text) > 0 && (
          <p className="err">
            {extraNotes(text) === 1
              ? t("1 note will be ignored: up to 6 guests per report.")
              : t("{n} notes will be ignored: up to 6 guests per report.", { n: extraNotes(text) })}
          </p>
        )}
        <div className="fields">
          <button className="btn" type="button" disabled={busy !== null} onClick={readNotes}>
            {busy === "read" ? t("Agent is reading the notes…") : t("1. Read the notes")}
          </button>
          <button className="btn ghost" type="button" disabled={busy !== null} onClick={() => byHand(null)}>
            {t("Skip the agent")}
          </button>
          <small className="label" style={{ margin: 0 }}>
            {t("The agent only keeps favourites that are written in the note; you confirm them before anything is edited.")}
          </small>
        </div>

        {read && (
          <div className="confirm">
            {manual && <p className="ask">{manual}</p>}
            {read.guests.map((g, gi) => (
              <div className="guest-card" key={gi}>
                <strong>{g.label}</strong> <span className="label">{g.text}</span>
                {g.not_considered && g.not_considered.length > 0 && (
                  <p className="other">{t("Not considered by the edit: {list}", { list: g.not_considered.join(", ") })}</p>
                )}
                <div className="chips">
                  {g.favourites.length === 0 && !manual && <span className="label">{t("No band, show, film, brand or game in this note.")}</span>}
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
                        {t("{n} matches for ‘{q}’. Which one do you mean?", { n: f.options!.length, q: f.query })}{" "}
                        {f.options!.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            className="chip"
                            aria-pressed={picked[key(gi, fi)]?.id === o.id}
                            onClick={() => toggle(key(gi, fi), fromOption(o))}
                          >
                            {o.name} <span className="label">({optionKind(o)})</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          className="chip"
                          aria-pressed={!picked[key(gi, fi)]}
                          onClick={() => setPicked((p) => ({ ...p, [key(gi, fi)]: null }))}
                        >
                          {t("None of these")}
                        </button>
                      </span>
                    ) : (
                      <span key={fi} className="label">
                        {t("‘{query}’ not found in Qloo", { query: f.query })}
                      </span>
                    ),
                  )}
                  <input
                    aria-label={t("Add a favourite for {label}", { label: g.label })}
                    placeholder={t("Add a favourite")}
                    value={adding[gi] ?? ""}
                    maxLength={120}
                    onChange={(e) => setAdding((a) => ({ ...a, [gi]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addFavourite(gi)}
                  />
                  <button type="button" className="chip" onClick={() => addFavourite(gi)}>
                    {t("Add")}
                  </button>
                </div>
              </div>
            ))}
            <div className="fields">
              <button className="btn" type="button" disabled={busy !== null} onClick={buildReport}>
                {busy === "report" ? t("Editing every list…") : t("2. Build the morning report")}
              </button>
            </div>
            {read.trace.length > 0 && (
              <details className="trace">
                <summary>{t("What the agent did ({n} tool calls)", { n: read.trace.length })}</summary>
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
        <section className="sheet report" aria-label={t("Morning report")}>
          <div className="sheet-head">
            <h2>
              {t("Morning report")} · {t(categoryLabel(report.category))} · {report.city}
            </h2>
            <span className="noprint" style={{ display: "flex", gap: 8 }}>
              <button
                className="btn ghost"
                type="button"
                onClick={() => navigator.clipboard?.writeText(reportText(report, t)).then(() => setCopied(true))}
              >
                {copied ? t("Copied") : t("Copy")}
              </button>
              <button className="btn" type="button" onClick={() => window.print()}>
                {t("Print")}
              </button>
            </span>
          </div>
          {report.guests.map((g, i) => {
            const r = g.result;
            if (r.status !== "ok")
              return (
                <div className="report-guest" key={i}>
                  <h3>{g.label}</h3>
                  {g.not_considered && g.not_considered.length > 0 && (
                    <p className="other">{t("Not considered: {list}", { list: g.not_considered.join(", ") })}</p>
                  )}
                  <p className="label">
                    {r.status === "skipped" ? t("No favourites confirmed, so the list stays as it is.") : t("A favourite needs a pick first.")}
                  </p>
                </div>
              );
            const ok = r as EditResult;
            return (
              <div className="report-guest" key={i}>
                <h3>
                  {g.label} <span className="for">{t("loves {names}", { names: guestName(ok.guest) })}</span>{" "}
                  <span className="count">
                    {t("{n} of {m} changed", { m: ok.length }).split("{n}")[0]}
                    <span className="red">{ok.changed}</span>
                    {t("{n} of {m} changed", { m: ok.length }).split("{n}")[1]}
                  </span>
                  {ok.cached && <span className="badge"> {t("cached result")}</span>}
                </h3>
                {g.not_considered && g.not_considered.length > 0 && (
                  <p className="other">{t("Not considered: {list}", { list: g.not_considered.join(", ") })}</p>
                )}
                {(() => {
                  // Said openly: guests with related tastes often get the same additions.
                  const mine = added(ok);
                  const same = report.guests
                    .filter((o, j) => j !== i && o.result.status === "ok")
                    .map((o) => ({ label: o.label, n: [...added(o.result as EditResult)].filter((x) => mine.has(x)).length }))
                    .filter((o) => o.n > 0);
                  return same.length > 0 && mine.size > 0 ? (
                    <p className="label">
                      {t("Additions shared with other rooms: {list}", {
                        list: same.map((o) => t("{n} of {m} with {room}", { n: o.n, m: mine.size, room: o.label })).join(" · "),
                      })}
                    </p>
                  ) : null;
                })()}
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
                              ? l.note
                              : [l.place.kind, l.place.neighborhood].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
          <p className="label">
            {t(LABEL)} {t("Open “Your guest (and list)” to accept or reject single changes.")}
          </p>
        </section>
      )}
    </>
  );
}

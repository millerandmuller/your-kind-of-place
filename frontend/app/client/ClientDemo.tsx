"use client";

import { useEffect, useState } from "react";
import { api, type Category, type EditResult, type Line } from "@/lib/api";
import { translate, type Lang } from "@/lib/lang";
import { LangContext } from "../LangContext";
import MapLink from "../MapLink";
import Footer, { DISCLAIMER } from "../Footer";
import Nav from "../Nav";

type City = "Toronto" | "Montreal";
type Guest = { honorific: "Ms." | "Mr."; surname: string; room: string; loves: { name: string; id: string }[] };

// A fictional hotel with one house in each city. The guests are curated: per city, the blind-test pair
// whose two guests share the fewest additions (see /how). Only names, as text.
const HOUSES: Record<City, Guest[]> = {
  Toronto: [
    {
      honorific: "Ms.", surname: "Okafor", room: "512",
      loves: [
        { name: "Drake", id: "FAA55DC8-6030-4CC8-9BA6-4668295C3FA7" },
        { name: "Canada Goose", id: "523A2129-8219-457B-88B3-A7B163C2E75E" },
      ],
    },
    {
      honorific: "Mr.", surname: "Lindqvist", room: "307",
      loves: [
        { name: "Schitt's Creek", id: "93804FA5-8089-488B-AE2C-C26D9E4F58DB" },
        { name: "Roots", id: "3407D614-2F29-4884-B93A-471CCD894488" },
      ],
    },
  ],
  Montreal: [
    {
      honorific: "Ms.", surname: "Tremblay", room: "214",
      loves: [
        { name: "Céline Dion", id: "DF97701E-5BD3-4F40-96F2-8EEA65FF81FC" },
        { name: "Cirque du Soleil", id: "A199C2C4-D78C-4AAA-988B-3D9DBA29ACE4" },
      ],
    },
    {
      honorific: "Mr.", surname: "Gagnon", room: "408",
      loves: [
        { name: "Arcade Fire", id: "7398A0D8-4BA6-48A8-9969-C27C509A3013" },
        { name: "Roots", id: "3407D614-2F29-4884-B93A-471CCD894488" },
      ],
    },
  ],
};
const CITIES: City[] = ["Toronto", "Montreal"];
const BUDGET = 5;

const HONORIFIC: Record<Lang, Record<Guest["honorific"], string>> = {
  en: { "Ms.": "Ms.", "Mr.": "Mr." },
  de: { "Ms.": "Frau", "Mr.": "Herr" },
  fr: { "Ms.": "Mme", "Mr.": "M." },
};
const cityName = (c: City, l: Lang) => (c === "Montreal" && l === "fr" ? "Montréal" : c);
const guestTitle = (g: Guest, l: Lang) => `${HONORIFIC[l][g.honorific]} ${g.surname}`;

export type ClientStart = { city: City; guest: number; kind: Category };

export function Leaf({ size = 28 }: { size?: number }) {
  return (
    <svg className="leaf" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 1l1.6 3.6 2-1-.6 4.6 3.2-2.4.8 1.8 3-.6-1.2 3.6 1.6.8-5.2 4.2.6 1.8-5-.8.1 4.9h-1.4l.1-4.9-5 .8.6-1.8L1.6 11.4l1.6-.8L2 7l3 .6.8-1.8L9 8.2l-.6-4.6 2 1z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ClientDemo({ lang: first, start }: { lang: Lang; start: ClientStart }) {
  const [lang, setLang] = useState<Lang>(first);
  // The phone has its own language (Montreal speaks French); the page's toggle sets both.
  const [phoneLang, setPhoneLang] = useState<Lang>(first);
  const choose = (l: Lang) => {
    setLang(l);
    setPhoneLang(l);
  };
  return (
    <LangContext.Provider value={{ lang, setLang: choose }}>
      <Demo appLang={lang} phoneLang={phoneLang} setPhoneLang={setPhoneLang} start={start} />
    </LangContext.Provider>
  );
}

function Demo({
  appLang,
  phoneLang,
  setPhoneLang,
  start,
}: {
  appLang: Lang;
  phoneLang: Lang;
  setPhoneLang: (l: Lang) => void;
  start: ClientStart;
}) {
  const [city, setCity] = useState<City>(start.city);
  const [gi, setGi] = useState(start.guest);
  const [kind, setKind] = useState<Category>(start.kind);
  // The answer is kept with the request it belongs to; anything else on screen is still loading.
  const [got, setGot] = useState<{ key: string; result?: EditResult; error?: boolean } | null>(null);
  const t = (en: string, vars?: Record<string, string | number>) => translate(appLang, en, vars);
  const guest = HOUSES[city][gi];

  const key = [city, gi, kind, phoneLang].join("|");
  const result = got?.key === key ? (got.result ?? null) : null;
  const error = got?.key === key && !!got.error;

  useEffect(() => {
    api
      .edit(city, guest.loves, BUDGET, undefined, kind, phoneLang)
      .then((r) => setGot(r.status === "ok" ? { key, result: r } : { key, error: true }))
      .catch(() => setGot({ key, error: true }));
    const q = new URLSearchParams({ city, g: String(gi), kind });
    window.history.replaceState(null, "", `/client?${q}`);
  }, [key, city, gi, kind, phoneLang, guest.loves]);

  return (
    <main className="wrap client-page mt">
      <Nav />
      <div className="mt-stage">
        <section className="mt-intro">
          <div className="mt-emblem">
            <Leaf size={44} />
            <span className="mt-emblem-word">MONTREONTO</span>
          </div>
          <h1 className="mt-wordmark">MONTREONTO HOTELS</h1>
          <p className="mt-eyebrow">{t("A fictional hotel · created for this demo")}</p>
          <p className="mt-lede">
            {t(
              "Montreonto {city}, Room {room}: what a guest gets on their phone after check-in. The hotel's list, edited for this guest. Tap a place to open it in Maps.",
              { city: cityName(city, appLang), room: guest.room },
            )}
          </p>
          <p className="mt-honest">{t("Places, notes and tags are live Qloo results. Montreonto is fictional.")}</p>
          <p className="mt-honest">{t(DISCLAIMER)}</p>
        </section>

        <div className="mt-phone" aria-label={t("A guest's phone")}>
          <div className="mt-status" aria-hidden="true">
            <span>9:41</span>
            <span className="mt-status-icons">
              <svg viewBox="0 0 18 12" width="17" height="11">
                <rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" />
                <rect x="5" y="5" width="3" height="7" rx="1" fill="currentColor" />
                <rect x="10" y="2.5" width="3" height="9.5" rx="1" fill="currentColor" />
                <rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" />
              </svg>
              <svg viewBox="0 0 26 12" width="25" height="12">
                <rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity="0.5" />
                <rect x="2" y="2" width="17" height="8" rx="1.8" fill="currentColor" />
                <rect x="23.5" y="4" width="1.8" height="4" rx="0.9" fill="currentColor" opacity="0.5" />
              </svg>
            </span>
          </div>
          <GuestView
            lang={phoneLang}
            setLang={setPhoneLang}
            langs={appLang === "de" ? ["en", "fr", "de"] : ["en", "fr"]}
            city={city}
            setCity={(c) => {
              setCity(c);
              setGi(0);
            }}
            gi={gi}
            setGi={setGi}
            kind={kind}
            setKind={setKind}
            result={result}
            error={error}
          />
        </div>
      </div>
      <Footer />
    </main>
  );
}

function GuestView(props: {
  lang: Lang;
  setLang: (l: Lang) => void;
  langs: Lang[];
  city: City;
  setCity: (c: City) => void;
  gi: number;
  setGi: (i: number) => void;
  kind: Category;
  setKind: (k: Category) => void;
  result: EditResult | null;
  error: boolean;
}) {
  const { lang, city, gi, kind, result } = props;
  const t = (en: string, vars?: Record<string, string | number>) => translate(lang, en, vars);
  const guest = HOUSES[city][gi];
  return (
    <div className="mt-screen" lang={lang}>
      <header className="mt-top">
        <span className="mt-brand">
          <Leaf size={16} />
          MONTREONTO
        </span>
        <span className="mt-langs" role="group" aria-label={t("Language")}>
          {props.langs.map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => props.setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </span>
      </header>

      <div className="mt-cities" role="group" aria-label={t("Hotel")}>
        {CITIES.map((c) => (
          <button key={c} type="button" aria-pressed={city === c} onClick={() => props.setCity(c)}>
            {cityName(c, lang)}
          </button>
        ))}
      </div>

      <div className="mt-guests" role="group" aria-label={t("Guest")}>
        {HOUSES[city].map((g, i) => (
          <button key={g.surname} type="button" aria-pressed={gi === i} onClick={() => props.setGi(i)}>
            <b>{guestTitle(g, lang)}</b>
            <span>{g.loves.map((x) => x.name).join(" + ")}</span>
          </button>
        ))}
      </div>
      <p className="mt-sample">{t("Sample guests, chosen to show contrast.")}</p>

      <h2 className="mt-welcome">
        {t("Welcome to Montreonto {city}, {name}", { city: cityName(city, lang), name: guestTitle(guest, lang) })}
      </h2>
      <p className="mt-room">
        {t("Room {room}", { room: guest.room })} · {t("Loves {list}", { list: guest.loves.map((x) => x.name).join(" + ") })}
      </p>

      <p className="mt-houselist">
        {t("Montreonto's house list (stands in: the city's top places with no taste signal)")}
        {result ? ` · ${t("{n} of {m} changed", { n: result.changed, m: result.length })}` : ""}
      </p>

      {props.error ? (
        <p className="mt-msg">{t("Couldn't load the list. Try again in a moment.")}</p>
      ) : !result ? (
        <p className="mt-msg" aria-live="polite">{t("Loading the list…")}</p>
      ) : (
        <>
          {result.changed === 0 && (
            <p className="mt-msg">
              {t(
                "Nothing changed for this guest: no entry on this list is outside the guest's top 50 taste matches, or there is no new match to put in its place.",
              )}
            </p>
          )}
          <ol className="mt-list">
          {result.lines.map((l) => (
              <PlaceLine key={`${l.status}-${l.place.id}`} l={l} city={city} lang={lang} />
            ))}
          </ol>
        </>
      )}

      <nav className="mt-tabs" aria-label={t("Lists")}>
        {(["dining", "nightlife"] as Category[]).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => props.setKind(k)}>
            {k === "dining" ? t("Restaurants & bars") : t("After dark")}
          </button>
        ))}
      </nav>
    </div>
  );
}

function PlaceLine({ l, city, lang }: { l: Line; city: City; lang: Lang }) {
  const meta = [l.place.kind, l.place.neighborhood].filter(Boolean).join(" · ");
  return (
    <li className={`mt-line ${l.status}`}>
      <div className="mt-line-body">
        <span className="mt-name">{l.place.name}</span>
        {meta && <span className="mt-meta">{meta}</span>}
        {l.status !== "keep" && l.note && <span className="mt-note">{l.note}</span>}
      </div>
      <LangContext.Provider value={{ lang }}>
        <MapLink p={l.place} city={city} struck={l.status === "strike"} />
      </LangContext.Provider>
    </li>
  );
}

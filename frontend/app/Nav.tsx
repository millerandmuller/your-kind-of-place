"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext } from "react";
import { LANGS, translate, type Lang } from "@/lib/lang";
import { LangContext } from "./LangContext";

// Day/night: the label follows the theme through CSS (.when-day / .when-night), so nothing here
// needs state; the choice is stored and the inline script in layout.tsx applies it before paint.
function flipTheme() {
  const root = document.documentElement;
  const next = root.dataset.theme === "night" ? "day" : "night";
  root.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {}
}

function storeLang(l: Lang) {
  document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = l;
}

// The language lives in a cookie so the server renders the right one first; `lang` is the server's
// choice on pages without a LangContext (How this works).
export default function Nav({ lang: serverLang }: { lang?: Lang }) {
  const ctx = useContext(LangContext);
  const router = useRouter();
  const lang = ctx.setLang ? ctx.lang : (serverLang ?? ctx.lang);
  const t = (en: string) => translate(lang, en);
  const choose = (l: Lang) => {
    storeLang(l);
    if (ctx.setLang) ctx.setLang(l);
    else router.refresh();
  };
  return (
    <nav className="nav noprint" aria-label="Main">
      <Link href="/" className="mark">
        Your Kind of <span className="ins">Place</span>
      </Link>
      <span className="links">
        <Link href="/how">{t("How this works")}</Link>
        <a href="https://github.com/millerandmuller/your-kind-of-place">Code</a>
        <span className="langs" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button key={l.id} type="button" aria-pressed={lang === l.id} title={l.name} onClick={() => choose(l.id)}>
              {l.label}
            </button>
          ))}
        </span>
        {/* The icon shows where the button takes you: a moon by day, a sun by night. */}
        <button type="button" className="theme-toggle" onClick={flipTheme} aria-label={t("Switch between day and night look")}>
          <span className="when-day" title={t("Switch to night")}>
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7Z" fill="currentColor" />
            </svg>
          </span>
          <span className="when-night" title={t("Switch to day")}>
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <circle cx="8" cy="8" r="3.2" fill="currentColor" />
              <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M3 13l1.1-1.1M11.9 4.1 13 3" />
              </g>
            </svg>
          </span>
        </button>
        <Link href="/client" className="client-btn">
          {t("Client demo")}
        </Link>
      </span>
    </nav>
  );
}

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
        <button type="button" className="theme-toggle" onClick={flipTheme} aria-label={t("Switch between day and night look")}>
          <span className="when-day">{t("Night")}</span>
          <span className="when-night">{t("Day")}</span>
        </button>
      </span>
    </nav>
  );
}

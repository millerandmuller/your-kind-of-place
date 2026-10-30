"use client";

import { useContext } from "react";
import { translate, type Lang } from "@/lib/lang";
import { LangContext } from "./LangContext";

export const DISCLAIMER =
  "Sample guests are fictional. Artist, show and brand names only describe what a guest likes; no affiliation with or endorsement by them is implied.";

// `lang` is the server's choice on pages without a LangContext (How this works).
export default function Footer({ lang: serverLang }: { lang?: Lang }) {
  const ctx = useContext(LangContext);
  const lang = ctx.setLang ? ctx.lang : (serverLang ?? ctx.lang);
  return (
    <footer className="foot noprint">
      <p>{translate(lang, DISCLAIMER)}</p>
    </footer>
  );
}

"use client";

import { createContext, useCallback, useContext } from "react";
import { translate, type Lang, type Vars } from "@/lib/lang";

export const LangContext = createContext<{ lang: Lang; setLang?: (l: Lang) => void }>({ lang: "en" });

/** t("Default list") → "Standardliste" in German; t("{n} of {m} changed", { n, m }) fills placeholders. */
export function useT() {
  const { lang } = useContext(LangContext);
  return useCallback((en: string, vars?: Vars) => translate(lang, en, vars), [lang]);
}

export function useLang(): Lang {
  return useContext(LangContext).lang;
}

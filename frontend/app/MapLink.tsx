"use client";

import { mapsUrl, type Place } from "@/lib/api";
import { useT } from "./LangContext";

// "Map ↗" on every place a guest could go to: a Google Maps search (name + address, or area + city),
// in a new tab. Struck places and lines Qloo couldn't match get none.
export default function MapLink({ p, city, struck = false }: { p: Place; city?: string; struck?: boolean }) {
  const t = useT();
  if (struck || p.in_qloo === false || p.in_house) return null;
  return (
    <a
      className="maplink noprint"
      href={mapsUrl(p, city)}
      target="_blank"
      rel="noreferrer"
      aria-label={t("{name} on Google Maps", { name: p.name })}
      title={t("Open in Google Maps")}
    >
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.4 4.5 8.5 4.5 8.5s4.5-5.1 4.5-8.5A4.5 4.5 0 0 0 8 1.5Zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z" fill="currentColor" />
      </svg>
      {t("Map")} ↗
    </a>
  );
}

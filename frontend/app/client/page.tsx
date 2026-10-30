import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Archivo, Source_Serif_4 } from "next/font/google";
import { pickLang } from "@/lib/lang";
import ClientDemo, { type ClientStart } from "./ClientDemo";

// Only this page uses the hotel's own type: Source Serif 4 for names, Archivo for the interface.
const serif = Source_Serif_4({ variable: "--font-mt-serif", subsets: ["latin"], style: ["normal", "italic"] });
const archivo = Archivo({ variable: "--font-mt-ui", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Client demo: Montreonto Hotels (fictional) · Your Kind of Place",
  description: "What a guest of a hotel gets on their phone after check-in: the hotel's list, edited for this guest.",
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Client({ searchParams }: PageProps<"/client">) {
  const q = await searchParams;
  const lang = pickLang((await cookies()).get("lang")?.value);
  const start: ClientStart = {
    city: one(q.city) === "Montreal" ? "Montreal" : "Toronto",
    guest: one(q.g) === "1" ? 1 : 0,
    kind: one(q.kind) === "nightlife" ? "nightlife" : "dining",
  };
  return (
    <div className={`mt-root ${serif.variable} ${archivo.variable}`}>
      <ClientDemo lang={lang} start={start} />
    </div>
  );
}

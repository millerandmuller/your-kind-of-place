import type { Metadata } from "next";
import { cookies } from "next/headers";
import Footer from "../Footer";
import Nav from "../Nav";
import { pickLang } from "@/lib/lang";
import HowDE from "./content.de";
import HowEN from "./content.en";
import HowFR from "./content.fr";

export const metadata: Metadata = { title: "How Your Kind of Place works" };

export default async function How() {
  const lang = pickLang((await cookies()).get("lang")?.value);
  return (
    <main className="wrap how">
      <Nav lang={lang} />
      {lang === "de" ? <HowDE /> : lang === "fr" ? <HowFR /> : <HowEN />}
      <Footer lang={lang} />
    </main>
  );
}

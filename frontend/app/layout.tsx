import type { Metadata } from "next";
import { Figtree, Fraunces, Geist, Newsreader } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

// Night look
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], style: ["normal", "italic"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Your Kind of Place: the hotel's list, edited for each guest",
  description: "Every hotel guest gets the same list of restaurants and bars. Your Kind of Place edits it for each guest, with a note on every change.",
};

// Before first paint: the remembered choice, else the system setting.
const THEME = `try{var t=localStorage.getItem("theme");if(t!=="day"&&t!=="night")t=matchMedia("(prefers-color-scheme: dark)").matches?"night":"day";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${serif.variable} ${fraunces.variable} ${figtree.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

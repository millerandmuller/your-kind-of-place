import type { Metadata } from "next";
import { Geist, Newsreader } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Your Kind of Place: the hotel's list, edited for each guest",
  description: "Every hotel guest gets the same list of restaurants and bars. Your Kind of Place edits it for each guest, with a note on every change.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}

"use client";

import Link from "next/link";

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

export default function Nav() {
  return (
    <nav className="nav noprint" aria-label="Main">
      <Link href="/" className="mark">
        Your Kind of <span className="ins">Place</span>
      </Link>
      <span className="links">
        <Link href="/how">How this works</Link>
        <a href="https://github.com/millerandmuller/your-kind-of-place">Code</a>
        <button type="button" className="theme-toggle" onClick={flipTheme} aria-label="Switch between day and night look">
          <span className="when-day">Night</span>
          <span className="when-night">Day</span>
        </button>
      </span>
    </nav>
  );
}

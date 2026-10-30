"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Track = { lang: string; src: string; label: string };

// A video that waits for a click: poster and one play button, nothing loads before (preload="none").
// After the click it plays with sound and with the subtitles in `subtitles`; the native controls take over.
export default function Video({
  src,
  poster,
  tracks,
  subtitles,
  playLabel,
  variant,
  caption,
}: {
  src: string;
  poster: string;
  tracks: Track[];
  subtitles: string;
  playLabel: string;
  variant: "gold" | "cream";
  caption: ReactNode;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  // Show exactly one subtitle track: the one for the chosen language.
  useEffect(() => {
    const v = ref.current;
    if (!v || !started) return;
    for (const t of Array.from(v.textTracks)) t.mode = t.language === subtitles ? "showing" : "disabled";
  }, [subtitles, started]);

  const play = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    setStarted(true);
    void v.play();
    v.focus();
  };

  return (
    <figure className={`video ${variant}`}>
      <div className="video-frame">
        <video ref={ref} poster={poster} preload="none" playsInline controls={started} tabIndex={started ? 0 : -1}>
          <source src={src} type="video/mp4" />
          {tracks.map((t) => (
            <track key={t.lang} kind="subtitles" src={t.src} srcLang={t.lang} label={t.label} default={t.lang === subtitles} />
          ))}
        </video>
        {!started && (
          <button type="button" className="video-play" aria-label={playLabel} onClick={play}>
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

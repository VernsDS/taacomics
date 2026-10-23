"use client";

import { useEffect, useState } from "react";

const LEVEL_STYLE = {
  info: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)", color: "#93c5fd" },
  warning: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", color: "#f87171" },
  success: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)", color: "#4ade80" },
};

export default function AnnouncementBanner() {
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [removing, setRemoving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem("taacomics_dismissed") || "[]"));
    } catch {
      setDismissed([]);
    }
    let cancelled = false;
    fetch("/api/announcements", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d?.items)) setItems(d.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const t1 = setTimeout(() => setRemoving(true), 15000);
    const t2 = setTimeout(() => setGone(true), 15500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [items]);

  function dismiss(id) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem("taacomics_dismissed", JSON.stringify(next));
    } catch {}
  }

  const visible = items.filter((it) => !dismissed.includes(it.id)).slice(0, 3);
  if (visible.length === 0 || gone) return null;

  return (
    <div
      className="space-y-2"
      style={{
        opacity: removing ? 0 : 1,
        transform: removing ? "translateY(-10px)" : "translateY(0)",
        transition: "opacity 500ms ease, transform 500ms ease",
      }}
    >
      {visible.map((it) => {
        const s = LEVEL_STYLE[it.level] || LEVEL_STYLE.info;
        return (
          <div
            key={it.id}
            className="flex items-start gap-3 rounded-2xl px-4 py-3"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}
            role="status"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
              <path d="M3 11l18-5v12L3 13v-2z" />
              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: s.color }}>{it.title}</p>
              {it.body && <p className="text-xs mt-0.5 text-gray-300">{it.body}</p>}
            </div>
            <button
              onClick={() => dismiss(it.id)}
              aria-label="Tutup"
              className="shrink-0 text-gray-400 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

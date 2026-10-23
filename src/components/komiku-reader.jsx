"use client";

import Link from "next/link";
import { useState } from "react";

export default function KomikuReader({ title, images, prevHref, nextHref, backHref }) {
  const [loadError, setLoadError] = useState({});

  return (
    <div className="min-h-screen" style={{ background: "#080a0f" }}>
      <div className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3" style={{ background: "rgba(8,10,15,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Link href={backHref} className="shrink-0 inline-flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Kembali
        </Link>
        <p className="text-sm font-semibold text-white truncate flex-1 text-center">{title}</p>
        <span className="text-xs text-gray-500 shrink-0">{images.length} hal.</span>
      </div>

      <div className="max-w-2xl mx-auto px-2 py-3 space-y-1">
        {images.map((src, i) => (
          <div key={src + i} className="relative" style={{ background: "rgba(255,255,255,0.03)" }}>
            {loadError[src] ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-500 text-xs">
                <p>Halaman {i + 1} gagal dimuat</p>
                <button
                  onClick={() => {
                    setLoadError((prev) => ({ ...prev, [src]: false }));
                    const el = document.getElementById(`kc-img-${i}`);
                    if (el) el.src = `/api/proxy/page?url=${encodeURIComponent(src)}&r=${Date.now()}`;
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}
                >
                  Coba Lagi
                </button>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                id={`kc-img-${i}`}
                src={`/api/proxy/page?url=${encodeURIComponent(src)}`}
                alt={`${title} halaman ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                className="w-full block"
                onError={() => setLoadError((prev) => ({ ...prev, [src]: true }))}
              />
            )}
          </div>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 flex gap-3">
        {prevHref ? (
          <Link href={prevHref} className="flex-1 text-center text-sm font-semibold px-4 py-3 rounded-xl text-white transition-opacity hover:opacity-80" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
            &larr; Prev
          </Link>
        ) : (
          <div className="flex-1 text-center text-sm px-4 py-3 rounded-xl text-gray-600" style={{ background: "rgba(255,255,255,0.03)" }}>
            &larr; Prev
          </div>
        )}
        {nextHref ? (
          <Link href={nextHref} className="flex-1 text-center text-sm font-bold px-4 py-3 rounded-xl transition-opacity hover:opacity-90" style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#1f1400" }}>
            Next &rarr;
          </Link>
        ) : (
          <div className="flex-1 text-center text-sm px-4 py-3 rounded-xl text-gray-600" style={{ background: "rgba(255,255,255,0.03)" }}>
            Next &rarr;
          </div>
        )}
      </div>
    </div>
  );
}

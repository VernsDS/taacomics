"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("TaaComics page error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div
        className="relative flex items-center justify-center mb-6"
        style={{ width: 112, height: 112 }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(239,68,68,0.25) 0%, rgba(245,158,11,0.08) 60%, transparent 75%)" }}
        />
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 9v4" strokeWidth="2.5" />
          <path d="M12 17h.01" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
        Terjadi kesalahan
      </h1>
      <p className="text-sm text-gray-400 max-w-md mb-8">
        Ada gangguan saat memuat halaman ini. Coba muat ulang &mdash; kalau masih gagal, coba lagi nanti.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="text-sm font-semibold px-6 py-3 rounded-xl text-white transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
        >
          Muat Ulang
        </button>
        <Link
          href="/"
          className="text-sm font-semibold px-6 py-3 rounded-xl transition-all active:scale-95"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#d1d5db" }}
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}

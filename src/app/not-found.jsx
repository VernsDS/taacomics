import Link from "next/link";

export const metadata = {
  title: "404 - Halaman Tidak Ditemukan | TaaComics",
};

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div
        className="relative flex items-center justify-center mb-6"
        style={{ width: 112, height: 112 }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(245,158,11,0.25) 0%, rgba(239,68,68,0.08) 60%, transparent 75%)" }}
        />
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          <path d="M8 11h.01M14 11h.01" strokeWidth="2.5" />
          <path d="M9 14.5s.9.9 2 .9 2-.9 2-.9" />
        </svg>
      </div>
      <p className="text-sm font-semibold tracking-widest mb-2" style={{ color: "#f59e0b" }}>404</p>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
        Halaman tidak ditemukan
      </h1>
      <p className="text-sm text-gray-400 max-w-md mb-8">
        Judul atau link yang kamu cari mungkin sudah dihapus, dipindahkan, atau saja memang tidak pernah ada.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="text-sm font-semibold px-6 py-3 rounded-xl text-white transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
        >
          Kembali ke Beranda
        </Link>
        <Link
          href="/search"
          className="text-sm font-semibold px-6 py-3 rounded-xl transition-all active:scale-95"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#d1d5db" }}
        >
          Cari Judul Lain
        </Link>
      </div>
    </div>
  );
}

"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MangaCard from "@/components/manga-card";

const SORT_OPTIONS = [
  { value: "latestUploadedChapter", label: "Terbaru" },
  { value: "followedCount", label: "Populer" },
  { value: "rating", label: "Rating" },
  { value: "relevance", label: "Relevan" },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qParam = searchParams.get("q") || "";
  const sortParam = searchParams.get("sort") || "latestUploadedChapter";

  const [query, setQuery] = useState(qParam);
  const [sort, setSort] = useState(sortParam);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const LIMIT = 24;

  const [mirrorItems, setMirrorItems] = useState([]);
  const [mirrorLoading, setMirrorLoading] = useState(false);

  useEffect(() => {
    async function fetchMirror(q) {
      if (!q) {
        setMirrorItems([]);
        return;
      }
      setMirrorLoading(true);
      try {
        const res = await fetch(`/api/komiku/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setMirrorItems(Array.isArray(data?.data) ? data.data : []);
      } catch {
        setMirrorItems([]);
      } finally {
        setMirrorLoading(false);
      }
    }
    fetchMirror(qParam);
  }, [qParam]);

  const fetchResults = useCallback(async (q, s, off = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: off, sort: s });
      if (q) params.set("q", q);
      const res = await fetch(`/api/manga?${params}`);
      const data = await res.json();
      if (off === 0) setResults(data.data || []);
      else setResults((prev) => [...prev, ...(data.data || [])]);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setOffset(0);
    fetchResults(qParam, sortParam, 0);
    setQuery(qParam);
    setSort(sortParam);
  }, [qParam, sortParam, fetchResults]);

  function handleSearch(e) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    p.set("sort", sort);
    router.push(`/search?${p}`);
  }

  function handleSortChange(s) {
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    p.set("sort", s);
    router.push(`/search?${p}`);
  }

  function loadMore() {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchResults(qParam, sortParam, newOffset);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      {/* Single Search Bar */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari manga, manhua, manhwa..."
            className="w-full text-sm text-gray-200 placeholder-gray-600 pl-11 pr-20 py-3.5 rounded-2xl outline-none transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            onFocus={e => e.target.style.borderColor = "rgba(245,158,11,0.4)"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
          />
          <button
            type="submit"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold px-4 py-2 rounded-xl text-white"
            style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
          >
            Cari
          </button>
        </div>
      </form>

      {/* Sort Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 hide-scrollbar">
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => handleSortChange(s.value)}
            className="flex-shrink-0 text-xs px-4 py-1.5 rounded-full transition-all font-medium"
            style={{
              background: sort === s.value ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "rgba(255,255,255,0.05)",
              border: sort === s.value ? "none" : "1px solid rgba(255,255,255,0.08)",
              color: sort === s.value ? "#080a0f" : "#9ca3af",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!loading && results.length > 0 && (
        <p className="text-xs text-gray-500 mb-4">{qParam ? `"${qParam}" - ` : ""}{total.toLocaleString()} judul ditemukan</p>
      )}

      {loading && results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500">Mencari...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20">
          <svg className="mx-auto mb-3" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <p className="text-gray-400">Tidak ada hasil ditemukan</p>
        </div>
      ) : (
        <>
          <div className="manga-grid">
            {results.map((m) => <MangaCard key={m.id} manga={m} />)}
          </div>
          {results.length < total && (
            <div className="flex justify-center mt-8">
              <button
                onClick={loadMore}
                disabled={loading}
                className="flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl text-white transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
              >
                {loading ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : null}
                {loading ? "Memuat..." : "Muat Lebih Banyak"}
              </button>
            </div>
          )}
        </>
      )}
      {qParam && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20"/></svg>
              Mirror Komiku
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}>ID</span>
            </h2>
          </div>
          {mirrorLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            </div>
          ) : mirrorItems.length > 0 ? (
            <div className="manga-grid">
              {mirrorItems.map((m) => (
                <Link
                  key={m.slug}
                  href={`/s/komiku/${m.slug}`}
                  className="group"
                >
                  <div className="rounded-2xl overflow-hidden transition-transform group-hover:scale-[1.03]" style={{ background: "#0d1018", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="relative" style={{ aspectRatio: "2/3", background: "rgba(255,255,255,0.04)" }}>
                      {m.cover && <img src={m.cover} alt={m.title} loading="lazy" className="w-full h-full object-cover" />}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-white truncate">{m.title}</p>
                      {m.latestChapter && <p className="text-[10px] mt-0.5" style={{ color: "#f59e0b" }}>{m.latestChapter}</p>}
                      <p className="text-[10px] text-gray-500">Komiku · Indonesia</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 py-3">Tidak ada hasil mirror untuk pencarian ini.</p>
          )}
        </section>
      )}
    </div>
  );
}

export default function SearchPage() {
  return <Suspense><SearchContent /></Suspense>;
}

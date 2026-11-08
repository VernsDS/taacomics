import MangaCard from "@/components/manga-card";
import HeroSlider from "@/components/HeroSlider";
import AnnouncementBanner from "@/components/announcement-banner";
import { filterBlocked } from "@/lib/blocklist";
import { USER_AGENT } from "@/lib/security";
import Link from "next/link";

export const revalidate = 300;

const MDEX = "https://api.mangadex.org";

async function fetchManga(sort, limit = 18) {
  try {
    const p = new URLSearchParams();
    p.append("limit", String(limit));
    p.append("includes[]", "cover_art");
    p.append("availableTranslatedLanguage[]", "en");
    p.append("contentRating[]", "safe");
    p.append("contentRating[]", "suggestive");
    p.append(`order[${sort}]`, "desc");
    const res = await fetch(`${MDEX}/manga?${p}`, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 300 },
    });
    const data = await res.json();
    const { items } = await filterBlocked(
      data.data || [],
      (m) => m?.attributes?.title?.en || Object.values(m?.attributes?.title || {})[0]
    );
    return items;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [latest, popular, topRated] = await Promise.all([
    fetchManga("latestUploadedChapter", 18),
    fetchManga("followedCount", 12),
    fetchManga("rating", 5),
  ]);

  return (
    <div>
      <div className="max-w-5xl mx-auto px-4 pt-3">
        <AnnouncementBanner />
      </div>
      <HeroSlider heroes={topRated} />
      <div className="max-w-5xl mx-auto px-4 pt-4 pb-4 space-y-8">
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {[
            { label: "Terbaru", href: "/search?sort=latestUploadedChapter" },
            { label: "Populer", href: "/search?sort=followedCount" },
            { label: "Rating Tinggi", href: "/search?sort=rating" },
            { label: "Manga", href: "/search?q=action manga" },
            { label: "Manhwa", href: "/search?q=manhwa romance" },
            { label: "Manhua", href: "/search?q=manhua cultivation" },
          ].map((chip) => (
            <Link
              key={chip.href}
              href={chip.href}
              className="flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full transition-all hover:text-white"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#9ca3af",
                whiteSpace: "nowrap",
              }}
            >
              {chip.label}
            </Link>
          ))}
        </div>
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Update Terbaru
            </h2>
            <Link
              href="/search?sort=latestUploadedChapter"
              className="text-xs hover:underline"
              style={{ color: "#f59e0b" }}
            >
              Lihat semua →
            </Link>
          </div>
          <div className="manga-grid">
            {latest.map((m) => (
              <MangaCard key={m.id} manga={m} />
            ))}
            {latest.length === 0 && (
              <p className="text-gray-500 text-sm col-span-full text-center py-10">
                Gagal memuat data. Coba refresh.
              </p>
            )}
          </div>
        </section>
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="0">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
              </svg>
              Paling Populer
            </h2>
            <Link
              href="/search?sort=followedCount"
              className="text-xs hover:underline"
              style={{ color: "#f59e0b" }}
            >
              Lihat semua →
            </Link>
          </div>
          <div className="manga-grid">
            {popular.map((m) => (
              <MangaCard key={m.id} manga={m} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

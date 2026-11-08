import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getKomikuDetail } from "@/lib/komiku";
import { getCustomChaptersForSlug } from "@/lib/customChapters";

export const revalidate = 600;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const detail = await getKomikuDetail(slug);
    return {
      title: `${detail.title} - TaaComics`,
      description: String(detail.synopsis || "").slice(0, 160),
    };
  } catch {
    return { title: "Komiku Mirror - TaaComics" };
  }
}

export default async function KomikuDetailPage({ params }) {
  const { slug } = await params;

  let detail;
  let customChapters = [];
  let customOnly = false;
  try {
    detail = await getKomikuDetail(slug);
  } catch {
    customChapters = await getCustomChaptersForSlug(slug);
    customOnly = customChapters.length > 0;
    if (!customOnly) notFound();
  }
  if (!customOnly && detail) {
    customChapters = await getCustomChaptersForSlug(slug);
  }

  const mergedChapters = detail ? [...detail.chapters] : [];
  for (const cc of customChapters) {
    mergedChapters.push({
      path: `custom-${cc.id}`,
      label: cc.label,
      date: "Chapter sendiri",
      custom: true,
    });
  }
  const resolvedDetail = detail || {
    slug,
    title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    altTitle: null,
    cover: null,
    synopsis: "Manga custom - chapter ditambahkan admin.",
    type: "Custom",
    status: "Ongoing",
    genres: [],
    chapterCount: customChapters.length,
    chapters: [],
  };
  resolvedDetail.chapterCount = mergedChapters.length;
  const firstPath = mergedChapters[mergedChapters.length - 1]?.path;
  const latestPath = mergedChapters[0]?.path;

  return (
    <div className="min-h-screen" style={{ background: "#080a0f" }}>
      <div className="max-w-5xl mx-auto px-4 py-5">
        <Link
          href="/search"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Kembali
        </Link>

        <div
          className="rounded-3xl overflow-hidden mb-5"
          style={{ background: "#0d1018", border: "1px solid rgba(245,158,11,0.12)" }}
        >
          <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
            <div className="w-32 sm:w-40 md:w-48 flex-shrink-0 mx-auto sm:mx-0">
              {resolvedDetail.cover ? (
                <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: "2/3" }}>
                  <Image
                    src={resolvedDetail.cover}
                    alt={resolvedDetail.title}
                    fill
                    sizes="(max-width: 640px) 128px, 192px"
                    priority
                    unoptimized
                    className="object-cover"
                  />
                </div>
              ) : (
                <div
                  className="w-full rounded-2xl flex items-center justify-center text-gray-600 text-xs"
                  style={{ aspectRatio: "2/3", background: "rgba(255,255,255,0.05)" }}
                >
                  Tanpa Cover
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}
                >
                  KOMIKU MIRROR
                </span>
                {customOnly && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(168,85,247,0.15)", color: "#d8b4fe" }}
                  >
                    CHAPTER SENDIRI
                  </span>
                )}
                {resolvedDetail.type && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd" }}
                  >
                    {resolvedDetail.type.toUpperCase()}
                  </span>
                )}
                {resolvedDetail.status && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}
                  >
                    {resolvedDetail.status.toUpperCase()}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">{resolvedDetail.title}</h1>
              {resolvedDetail.altTitle && (
                <p className="text-xs text-gray-500 mb-3">{resolvedDetail.altTitle}</p>
              )}
              {resolvedDetail.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start mb-4">
                  {resolvedDetail.genres.slice(0, 8).map((g) => (
                    <span
                      key={g}
                      className="text-[11px] px-2.5 py-1 rounded-full text-gray-300"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {latestPath && (
                  <Link
                    href={`/s/komiku/${slug}/${latestPath}`}
                    className="text-sm font-bold px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90"
                    style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#1f1400" }}
                  >
                    Baca Terbaru {detail?.latest ? `(${detail.latest.label})` : ""}
                  </Link>
                )}
                {firstPath && (
                  <Link
                    href={`/s/komiku/${slug}/${firstPath}`}
                    className="text-sm font-semibold px-5 py-2.5 rounded-xl text-gray-200 transition-opacity hover:opacity-80"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    Dari Awal
                  </Link>
                )}
              </div>
            </div>
          </div>

          {resolvedDetail.synopsis && (
            <div className="px-4 sm:px-5 pb-5">
              <h2 className="text-sm font-bold mb-1.5" style={{ color: "#f59e0b" }}>
                Sinopsis
              </h2>
              <p className="text-xs leading-relaxed text-gray-400">{resolvedDetail.synopsis}</p>
            </div>
          )}
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
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
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Daftar Chapter
              <span className="text-xs font-normal text-gray-500">({mergedChapters.length})</span>
            </h2>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {mergedChapters.map((ch) => (
              <Link
                key={ch.path}
                href={`/s/komiku/${slug}/${ch.path}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-sm font-medium text-gray-200">
                  {ch.label}
                  {ch.custom && (
                    <span
                      className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(168,85,247,0.15)", color: "#d8b4fe" }}
                    >
                      SENDIRI
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-gray-500">{ch.date}</span>
              </Link>
            ))}
            {mergedChapters.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">Tidak ada chapter terscraper.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

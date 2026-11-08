import { NextResponse } from "next/server";
import { filterBlocked } from "@/lib/blocklist";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCorsHeaders, USER_AGENT } from "@/lib/security";

export const runtime = "nodejs";
export const revalidate = 120;

const BASE = "https://api.mangadex.org";

export async function GET(request) {
  const corsHeaders = getCorsHeaders(request, "GET, OPTIONS");

  try {
    const rl = await checkRateLimit(request, {
      scope: "manga_list",
      limit: 60,
      window: "1 m",
    });

    if (!rl.success) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan." },
        { status: 429, headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().slice(0, 100);
    const limit = Math.min(48, Math.max(1, Number(searchParams.get("limit")) || 24));
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
    const sort = searchParams.get("sort") || "latestUploadedChapter";

    const params = new URLSearchParams();
    params.append("limit", String(limit));
    params.append("offset", String(offset));
    params.append("includes[]", "cover_art");
    params.append("availableTranslatedLanguage[]", "en");
    params.append("contentRating[]", "safe");
    params.append("contentRating[]", "suggestive");

    if (q) {
      params.append("title", q);
    } else {
      params.append(`order[${sort}]`, "desc");
    }

    const res = await fetch(`${BASE}/manga?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 120 },
    });

    const data = await res.json();
    const { items, hidden } = await filterBlocked(
      data.data || [],
      (m) => m?.attributes?.title?.en || Object.values(m?.attributes?.title || {})[0]
    );
    data.data = items;
    if (hidden > 0 && typeof data.total === "number") {
      data.total = Math.max(0, data.total - hidden);
    }

    return NextResponse.json(data, {
      headers: {
        ...corsHeaders,
        ...rl.headers,
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: corsHeaders });
  }
}

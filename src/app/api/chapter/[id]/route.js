import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCorsHeaders, USER_AGENT } from "@/lib/security";

export const runtime = "nodejs";
export const revalidate = 600;

const BASE = "https://api.mangadex.org";
const FALLBACK_BASE = "https://uploads.mangadex.org";

export async function GET(request, { params }) {
  const corsHeaders = getCorsHeaders(request, "GET, OPTIONS");

  try {
    const rl = await checkRateLimit(request, {
      scope: "chapter_pages",
      limit: 60,
      window: "1 m",
    });

    if (!rl.success) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan." },
        { status: 429, headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    const { id } = await params;
    const res = await fetch(`${BASE}/at-home/server/${id}`, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 600 },
    });
    const data = await res.json();

    if (data?.chapter && !data.chapter.baseUrl) {
      data.chapter.baseUrl = FALLBACK_BASE;
    }

    return NextResponse.json(data, {
      headers: {
        ...corsHeaders,
        ...rl.headers,
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: corsHeaders });
  }
}

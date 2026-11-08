import { NextResponse } from "next/server";
import { fetchChaptersForManga } from "@/lib/chapters";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCorsHeaders } from "@/lib/security";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(request, { params }) {
  const corsHeaders = getCorsHeaders(request, "GET, OPTIONS");

  try {
    const rl = await checkRateLimit(request, {
      scope: "manga_chapters",
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
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get("lang");

    const total = await fetchChaptersForManga(id, { lang });

    return NextResponse.json(
      {
        result: "ok",
        response: "collection",
        data: total,
        total: total.length,
      },
      {
        headers: {
          ...corsHeaders,
          ...rl.headers,
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      }
    );
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: corsHeaders });
  }
}

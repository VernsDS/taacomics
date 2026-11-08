import { NextResponse } from "next/server";
import { searchKomiku } from "@/lib/komiku";
import { filterBlocked } from "@/lib/blocklist";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCorsHeaders } from "@/lib/security";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(request) {
  const corsHeaders = getCorsHeaders(request, "GET, OPTIONS");

  try {
    const rl = await checkRateLimit(request, {
      scope: "komiku_search",
      limit: 30,
      window: "1 m",
    });

    if (!rl.success) {
      return NextResponse.json(
        { ok: false, data: [], error: "Rate limit exceeded" },
        { status: 429, headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().slice(0, 100);
    const { items } = await filterBlocked(await searchKomiku(q), (m) => m?.title);

    return NextResponse.json(
      { ok: true, data: items },
      {
        headers: {
          ...corsHeaders,
          ...rl.headers,
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: true, data: [], error: err?.message || "mirror error" },
      { headers: corsHeaders }
    );
  }
}

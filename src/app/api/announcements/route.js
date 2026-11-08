import { NextResponse } from "next/server";
import { readAnnouncements } from "@/lib/announcementsStore";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCorsHeaders } from "@/lib/security";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(request) {
  const corsHeaders = getCorsHeaders(request, "GET, OPTIONS");

  try {
    const rl = await checkRateLimit(request, {
      scope: "public_announcements",
      limit: 60,
      window: "1 m",
    });

    if (!rl.success) {
      return NextResponse.json(
        { ok: false, items: [], error: "Rate limit exceeded" },
        { status: 429, headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    const data = await readAnnouncements();
    const items = (data?.items || [])
      .filter((it) => it.active)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(({ id, title, body, level, createdAt }) => ({ id, title, body, level, createdAt }));

    return NextResponse.json(
      { ok: true, items },
      {
        headers: {
          ...corsHeaders,
          ...rl.headers,
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch {
    return NextResponse.json({ ok: true, items: [] }, { headers: corsHeaders });
  }
}

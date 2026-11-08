import { NextResponse } from "next/server";
import { readMaintenance } from "@/lib/siteStatus";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCorsHeaders } from "@/lib/security";

export const runtime = "nodejs";
export const revalidate = 30;

export async function GET(request) {
  const corsHeaders = getCorsHeaders(request, "GET, OPTIONS");

  try {
    const rl = await checkRateLimit(request, {
      scope: "site_status",
      limit: 60,
      window: "1 m",
    });

    if (!rl.success) {
      return NextResponse.json(
        { ok: false, maintenance: false },
        { status: 429, headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    const { enabled, message } = await readMaintenance();
    return NextResponse.json(
      { ok: true, maintenance: enabled, message },
      {
        headers: {
          ...corsHeaders,
          ...rl.headers,
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch {
    return NextResponse.json({ ok: true, maintenance: false }, { headers: corsHeaders });
  }
}

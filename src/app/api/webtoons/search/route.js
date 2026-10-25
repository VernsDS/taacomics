import { NextResponse } from "next/server";
import { searchWebtoons } from "@/lib/webtoons";
import { filterBlocked } from "@/lib/blocklist";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  try {
    const { items } = await filterBlocked(await searchWebtoons(q), (m) => m?.title);
    return NextResponse.json({ ok: true, data: items });
  } catch (err) {
    return NextResponse.json({ ok: true, data: [], error: err?.message || "mirror error" });
  }
}

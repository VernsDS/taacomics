import { NextResponse } from "next/server";
import { searchKomiku } from "@/lib/komiku";
import { filterBlocked } from "@/lib/blocklist";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  try {
    const { items } = filterBlocked(await searchKomiku(q), (m) => m?.title);
    return NextResponse.json({ ok: true, data: items });
  } catch (err) {
    return NextResponse.json({ ok: true, data: [], error: err?.message || "mirror error" });
  }
}

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/index";
import { getActiveAdminSession } from "@/lib/adminAuth";
import { USER_AGENT } from "@/lib/security";

export const runtime = "nodejs";

async function probeUrl(name, url) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    return {
      name,
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name,
      ok: false,
      status: 0,
      latencyMs: Date.now() - start,
      error: err.message,
    };
  }
}

export async function GET() {
  const session = await getActiveAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const dbStart = Date.now();
  let dbCheck = { name: "PostgreSQL (Neon)", ok: false, latencyMs: 0 };
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    dbCheck = { name: "PostgreSQL (Neon)", ok: true, latencyMs: Date.now() - dbStart };
  } catch (err) {
    dbCheck = {
      name: "PostgreSQL (Neon)",
      ok: false,
      latencyMs: Date.now() - dbStart,
      error: err.message,
    };
  }

  const [mangadex, komiku, webtoons] = await Promise.all([
    probeUrl("MangaDex API", "https://api.mangadex.org/ping"),
    probeUrl("Komiku Mirror", "https://api.komiku.org/manga/?post_type=manga&s=one"),
    probeUrl("Webtoons ID", "https://www.webtoons.com/id"),
  ]);

  return NextResponse.json({
    ok: true,
    checks: [dbCheck, mangadex, komiku, webtoons],
    checkedAt: new Date().toISOString(),
  });
}

/**
 * Manga Blocklist store backed by PostgreSQL (Neon) + Drizzle.
 */
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { blocklist } from "@/db/schema";

let memoryCache = { at: 0, items: null };
const CACHE_TTL_MS = 30_000;

export async function fetchBlocklistKeywords() {
  if (memoryCache.items && Date.now() - memoryCache.at < CACHE_TTL_MS) {
    return memoryCache.items;
  }

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(blocklist)
      .orderBy(asc(blocklist.keyword));

    const keywords = rows
      .map((r) => String(r.keyword || "").toLowerCase().trim())
      .filter(Boolean);

    memoryCache = { at: Date.now(), items: keywords };
    return keywords;
  } catch (err) {
    console.error("[blocklist] DB read error:", err.message);
    return [];
  }
}

export async function listBlocklistEntries() {
  const db = getDb();
  return db.select().from(blocklist).orderBy(asc(blocklist.keyword));
}

export async function addBlocklistKeyword(rawKeyword, reason = "") {
  const keyword = String(rawKeyword || "").trim().toLowerCase().slice(0, 120);
  if (!keyword) {
    return { ok: false, error: "Kata kunci blocklist wajib diisi." };
  }

  const db = getDb();
  await db
    .insert(blocklist)
    .values({
      keyword,
      reason: String(reason || "").trim().slice(0, 240) || null,
    })
    .onConflictDoNothing({ target: blocklist.keyword });

  memoryCache = { at: 0, items: null };
  return { ok: true, keyword };
}

export async function removeBlocklistKeyword(idOrKeyword) {
  const db = getDb();
  if (typeof idOrKeyword === "number" || /^\d+$/.test(String(idOrKeyword))) {
    await db.delete(blocklist).where(eq(blocklist.id, Number(idOrKeyword)));
  } else {
    const kw = String(idOrKeyword || "").trim().toLowerCase();
    await db.delete(blocklist).where(eq(blocklist.keyword, kw));
  }
  memoryCache = { at: 0, items: null };
  return { ok: true };
}

export async function filterBlocked(list, getTitle) {
  const blocked = await fetchBlocklistKeywords();
  const safeList = Array.isArray(list) ? list : [];
  if (blocked.length === 0) return { items: safeList, hidden: 0 };

  const items = safeList.filter((m) => {
    const title = String(getTitle(m) || "").toLowerCase();
    return !blocked.some((kw) => title.includes(kw));
  });

  return { items, hidden: safeList.length - items.length };
}

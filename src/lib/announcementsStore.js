/**
 * Announcement store for TaaComics backed by PostgreSQL (Neon) + Drizzle.
 * Fixes Finding #2: normalize(null) no longer returns a truthy object that masks failures.
 * Local JSON fallback is used only if DB is unreachable during read-only public rendering.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { announcements } from "@/db/schema";

const DATA_FILE = path.join(process.cwd(), "data", "announcements.json");

const DEFAULT_DATA = {
  items: [
    {
      id: "a_welcome",
      title: "Selamat datang di TaaComics",
      body: "Baca manga, manhua & manhwa gratis dengan prioritas chapter bahasa Indonesia.",
      level: "info",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

/**
 * Returns null if input is null/undefined or lacks an items array,
 * allowing callers to accurately detect upstream failures and trigger fallbacks.
 */
export function normalize(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
    return null;
  }
  return { items: data.items.filter(Boolean) };
}

export function newId() {
  return `a_${crypto.randomBytes(6).toString("hex")}`;
}

export function sanitizeAnnouncement(input) {
  const title = String(input?.title || "").trim().slice(0, 120);
  const body = String(input?.body || "").trim().slice(0, 600);
  const level = ["info", "warning", "success"].includes(input?.level) ? input.level : "info";
  const active = input?.active === false ? false : true;
  if (!title) return null;
  return {
    id: input?.id ? String(input.id) : newId(),
    title,
    body,
    level,
    active,
    createdAt: input?.createdAt || new Date().toISOString(),
  };
}

export async function readAnnouncements() {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt));

    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        level: r.level,
        active: r.active,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      })),
    };
  } catch (err) {
    console.error("[announcementsStore] DB read error, falling back to local JSON:", err.message);
    try {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      return normalize(raw) || DEFAULT_DATA;
    } catch {
      return DEFAULT_DATA;
    }
  }
}

export async function createAnnouncement(input) {
  const clean = sanitizeAnnouncement(input);
  if (!clean) return { ok: false, error: "Judul pengumuman wajib diisi." };

  const db = getDb();
  await db.insert(announcements).values({
    id: clean.id,
    title: clean.title,
    body: clean.body,
    level: clean.level,
    active: clean.active,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { ok: true, item: clean };
}

export async function toggleAnnouncementActive(id, active) {
  const cleanId = String(id || "").trim();
  if (!cleanId) return { ok: false, error: "ID pengumuman wajib diisi." };

  const db = getDb();
  await db
    .update(announcements)
    .set({ active: Boolean(active), updatedAt: new Date() })
    .where(eq(announcements.id, cleanId));

  return { ok: true };
}

export async function deleteAnnouncementById(id) {
  const cleanId = String(id || "").trim();
  if (!cleanId) return { ok: false, error: "ID pengumuman wajib diisi." };

  const db = getDb();
  await db.delete(announcements).where(eq(announcements.id, cleanId));
  return { ok: true };
}

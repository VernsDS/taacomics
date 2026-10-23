/**
 * Announcement store untuk TaaComics.
 * - Local/self-host: JSON file di <project>/data/announcements.json
 * - Production (Vercel read-only FS): dukung ANNOUNCEMENTS_URL (URL JSON publik, mis. zfile.web.id)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "announcements.json");

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

function normalize(data) {
  const items = Array.isArray(data?.items) ? data.items.filter(Boolean) : [];
  return { items };
}

async function fetchRemote() {
  const url = process.env.ANNOUNCEMENTS_URL;
  if (!url) return null;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  try {
    return normalize(await res.json());
  } catch {
    return null;
  }
}

export async function readAnnouncements() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return normalize(JSON.parse(raw));
  } catch {
    const remote = await fetchRemote();
    return remote || normalize(DEFAULT_DATA);
  }
}

export async function writeAnnouncements(data) {
  const clean = normalize(data);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(clean, null, 2), "utf8");
    return { ok: true };
  } catch (err) {
    // Vercel: filesystem read-only
    return { ok: false, code: "READ_ONLY_FS", message: String(err?.message || err) };
  }
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
  return { title, body, level, active, id: input?.id, createdAt: input?.createdAt };
}

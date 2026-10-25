import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "custom_chapters.json");

import { fetchPanelData } from "@/lib/adminData";

/** Data chapter custom: admin panel remote (jika diset) atau file lokal. */
async function readSourceAll() {
  const panel = await fetchPanelData("/api/public/custom-chapters");
  if (panel && panel.chapters && typeof panel.chapters === "object") {
    return panel.chapters;
  }
  return readAll();
}

function readAll() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    const chapters = raw && typeof raw.chapters === "object" && raw.chapters !== null ? raw.chapters : {};
    Object.keys(chapters).forEach((slug) => {
      if (!Array.isArray(chapters[slug])) delete chapters[slug];
    });
    return chapters;
  } catch {
    return {};
  }
}

function writeAll(chapters) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ chapters }, null, 2), "utf8");
    return { ok: true };
  } catch (err) {
    return { ok: false, code: "READ_ONLY_FS", message: String(err?.message || err) };
  }
}

function sanitizeSlug(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^\/?(manga\/)?|\/+$/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

export async function getCustomChaptersForSlug(rawSlug) {
  const slug = sanitizeSlug(rawSlug);
  if (!slug) return [];
  const all = await readSourceAll();
  return (all[slug] || [])
    .slice()
    .sort((a, b) => (a.number || 0) - (b.number || 0))
    .map((ch) => ({
      id: ch.id,
      label: ch.label,
      number: ch.number,
      images: Array.isArray(ch.images) ? ch.images.filter((u) => /^https?:\/\//i.test(u)) : [],
      createdAt: ch.createdAt,
    }));
}

export async function findCustomChapter(rawSlug, chapterId) {
  const slug = sanitizeSlug(rawSlug);
  const id = String(chapterId || "").replace(/^custom-/, "").replace(/[^a-z0-9_-]/gi, "");
  const all = await readSourceAll();
  const direct = (all[slug] || []).find((ch) => ch.id === id)
    || Object.values(all)
      .flat()
      .find((ch) => ch.id === id) || null;
  if (!direct) return null;
  return {
    title: direct.label,
    images: (Array.isArray(direct.images) ? direct.images : []).filter((u) => /^https?:\/\//i.test(u)),
    prev: null,
    next: null,
    direct: true,
  };
}

export function addCustomChapter(rawSlug, { label, images }) {
  const slug = sanitizeSlug(rawSlug);
  const imgs = (Array.isArray(images) ? images : [])
    .map((x) => String(x).trim())
    .filter((x) => /^https?:\/\//i.test(x));
  const text = String(label || "").trim() || "Chapter Kaprofit";
  const num = parseFloat(text.replace(/[^\d.]/g, ""));

  if (!slug) return { ok: false, error: "Slug manga wajib diisi (contoh: manga-one-punch-man)" };
  if (imgs.length === 0) return { ok: false, error: "Minimal 1 URL gambar" };

  const chapters = readAll();
  const item = {
    id: `c_${crypto.randomBytes(5).toString("hex")}`,
    label: text,
    number: Number.isFinite(num) ? num : 0,
    images: imgs,
    createdAt: new Date().toISOString(),
  };
  if (!chapters[slug]) chapters[slug] = [];
  chapters[slug].push(item);

  const result = writeAll(chapters);
  if (!result.ok) return { ok: false, code: result.code, error: result.code };
  return { ok: true, item, slug };
}

export function deleteCustomChapter(id) {
  const chapters = readAll();
  const clean = String(id || "").replace(/^custom-/, "");
  let removed = 0;
  Object.keys(chapters).forEach((slug) => {
    const before = chapters[slug].length;
    chapters[slug] = chapters[slug].filter((ch) => ch.id !== clean);
    removed += before - chapters[slug].length;
    if (chapters[slug].length === 0) delete chapters[slug];
  });
  if (removed === 0) return { ok: false, error: "Custom chapter tidak ditemukan" };
  const result = writeAll(chapters);
  if (!result.ok) return { ok: false, code: result.code, error: `Gagal menyimpan (${result.code})` };
  return { ok: true, removed };
}

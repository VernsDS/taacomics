/**
 * Custom Chapters store backed by PostgreSQL (Neon) + Drizzle.
 * Enforces strict image domain allowlist (ALLOWED_IMAGE_DOMAINS) on both write and read.
 */
import crypto from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/index";
import { customManga, customChapters, customChapterPages } from "@/db/schema";
import { isAllowedCustomImageUrl, ALLOWED_IMAGE_DOMAINS } from "@/lib/security";

export function sanitizeSlug(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^\/?(manga\/)?|\/+$/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

export async function getCustomChaptersForSlug(rawSlug) {
  const slug = sanitizeSlug(rawSlug);
  if (!slug) return [];

  try {
    const db = getDb();
    const chapters = await db
      .select()
      .from(customChapters)
      .where(eq(customChapters.slug, slug))
      .orderBy(asc(customChapters.number), asc(customChapters.createdAt));

    if (chapters.length === 0) return [];

    const chapterIds = chapters.map((c) => c.id);
    const pages = await db
      .select()
      .from(customChapterPages)
      .where(inArray(customChapterPages.chapterId, chapterIds))
      .orderBy(asc(customChapterPages.pageNumber));

    const pagesByChapter = new Map();
    for (const p of pages) {
      if (!isAllowedCustomImageUrl(p.imageUrl)) continue;
      if (!pagesByChapter.has(p.chapterId)) pagesByChapter.set(p.chapterId, []);
      pagesByChapter.get(p.chapterId).push(p.imageUrl);
    }

    return chapters.map((ch) => ({
      id: ch.id,
      label: ch.label,
      number: ch.number,
      images: pagesByChapter.get(ch.id) || [],
      createdAt: ch.createdAt instanceof Date ? ch.createdAt.toISOString() : String(ch.createdAt),
    }));
  } catch (err) {
    console.error("[customChapters] DB read error:", err.message);
    return [];
  }
}

export async function findCustomChapter(rawSlug, chapterId) {
  const id = String(chapterId || "")
    .replace(/^custom-/, "")
    .replace(/[^a-z0-9_-]/gi, "");
  if (!id) return null;

  try {
    const db = getDb();
    const [ch] = await db
      .select()
      .from(customChapters)
      .where(eq(customChapters.id, id))
      .limit(1);

    if (!ch) return null;

    const pages = await db
      .select()
      .from(customChapterPages)
      .where(eq(customChapterPages.chapterId, ch.id))
      .orderBy(asc(customChapterPages.pageNumber));

    const validImages = pages
      .map((p) => p.imageUrl)
      .filter((u) => isAllowedCustomImageUrl(u));

    if (validImages.length === 0) return null;

    return {
      title: ch.label,
      images: validImages,
      prev: null,
      next: null,
      direct: false, // Route through /api/proxy/page for consistent headers & caching
    };
  } catch (err) {
    console.error("[customChapters] findCustomChapter error:", err.message);
    return null;
  }
}

export async function listAllCustomChaptersAdmin() {
  const db = getDb();
  const chapters = await db
    .select()
    .from(customChapters)
    .orderBy(asc(customChapters.slug), asc(customChapters.number));

  const pages = await db
    .select()
    .from(customChapterPages)
    .orderBy(asc(customChapterPages.pageNumber));

  const countMap = new Map();
  for (const p of pages) {
    countMap.set(p.chapterId, (countMap.get(p.chapterId) || 0) + 1);
  }

  return chapters.map((ch) => ({
    id: ch.id,
    slug: ch.slug,
    label: ch.label,
    number: ch.number,
    pageCount: countMap.get(ch.id) || 0,
    createdAt: ch.createdAt instanceof Date ? ch.createdAt.toISOString() : String(ch.createdAt),
  }));
}

export async function addCustomChapter(rawSlug, { title, label, images }) {
  const slug = sanitizeSlug(rawSlug);
  if (!slug) {
    return { ok: false, error: "Slug manga wajib diisi (contoh: one-punch-man)." };
  }

  const rawList = Array.isArray(images)
    ? images
    : String(images || "")
        .split(/\r?\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);

  if (rawList.length === 0) {
    return { ok: false, error: "Minimal 1 URL gambar wajib diisi." };
  }

  const invalidUrls = rawList.filter((u) => !isAllowedCustomImageUrl(u));
  if (invalidUrls.length > 0) {
    return {
      ok: false,
      error: `URL gambar ditolak karena domain tidak masuk allowlist (${invalidUrls[0]}). Domain yang diizinkan: ${ALLOWED_IMAGE_DOMAINS.join(", ")}`,
    };
  }

  const text = String(label || "").trim().slice(0, 120) || "Chapter Custom";
  const num = parseFloat(text.replace(/[^\d.]/g, ""));
  const chapterNumber = Number.isFinite(num) ? num : 0;
  const mangaTitle =
    String(title || "").trim().slice(0, 160) ||
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const db = getDb();

  await db
    .insert(customManga)
    .values({
      slug,
      title: mangaTitle,
      synopsis: "Manga custom yang dikelola admin TaaComics.",
      type: "Custom",
      status: "Ongoing",
    })
    .onConflictDoNothing({ target: customManga.slug });

  const [mangaRow] = await db
    .select()
    .from(customManga)
    .where(eq(customManga.slug, slug))
    .limit(1);

  const chapterId = `c_${crypto.randomBytes(5).toString("hex")}`;
  await db.insert(customChapters).values({
    id: chapterId,
    mangaId: mangaRow.id,
    slug,
    label: text,
    number: chapterNumber,
  });

  const pageValues = rawList.map((url, idx) => ({
    chapterId,
    pageNumber: idx + 1,
    imageUrl: url,
  }));

  await db.insert(customChapterPages).values(pageValues);

  return {
    ok: true,
    slug,
    item: {
      id: chapterId,
      slug,
      label: text,
      number: chapterNumber,
      pageCount: pageValues.length,
    },
  };
}

export async function deleteCustomChapter(id) {
  const cleanId = String(id || "")
    .replace(/^custom-/, "")
    .replace(/[^a-z0-9_-]/gi, "");
  if (!cleanId) return { ok: false, error: "ID chapter tidak valid." };

  const db = getDb();
  await db.delete(customChapters).where(eq(customChapters.id, cleanId));
  return { ok: true };
}

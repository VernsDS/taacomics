#!/usr/bin/env node
/**
 * Import legacy JSON files (data/announcements.json, data/maintenance.json,
 * data/blocklist.json, data/custom_chapters.json) into Neon PostgreSQL via Drizzle.
 * Idempotent: safe to run multiple times.
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db/index.js";
import {
  announcements,
  siteSettings,
  blocklist,
  customManga,
  customChapters,
  customChapterPages,
} from "../src/db/schema.js";

const DATA_DIR = path.join(process.cwd(), "data");

function readJsonIfExists(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.warn(`[import-legacy] Failed to parse ${filename}:`, err.message);
    return null;
  }
}

async function importAnnouncements(db) {
  const data = readJsonIfExists("announcements.json");
  if (!data || !Array.isArray(data.items)) {
    console.log("[import-legacy] No data/announcements.json found or empty, skipping.");
    return;
  }
  let count = 0;
  for (const item of data.items) {
    if (!item?.id || !item?.title) continue;
    const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
    await db
      .insert(announcements)
      .values({
        id: String(item.id),
        title: String(item.title).trim().slice(0, 120),
        body: String(item.body || "").trim().slice(0, 600),
        level: ["info", "warning", "success"].includes(item.level) ? item.level : "info",
        active: item.active !== false,
        createdAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: announcements.id,
        set: {
          title: String(item.title).trim().slice(0, 120),
          body: String(item.body || "").trim().slice(0, 600),
          level: ["info", "warning", "success"].includes(item.level) ? item.level : "info",
          active: item.active !== false,
          updatedAt: new Date(),
        },
      });
    count++;
  }
  console.log(`[import-legacy] Imported ${count} announcements.`);
}

async function importMaintenance(db) {
  const data = readJsonIfExists("maintenance.json");
  if (!data) {
    console.log("[import-legacy] No data/maintenance.json found, skipping.");
    return;
  }
  const value = {
    enabled: Boolean(data.enabled),
    message: String(data.message || "MAAF SERVER SEDANG DALAM MASA PEMELIHARAAN"),
  };
  await db
    .insert(siteSettings)
    .values({ key: "maintenance", value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value, updatedAt: new Date() },
    });
  console.log(`[import-legacy] Imported maintenance setting (enabled=${value.enabled}).`);
}

async function importBlocklist(db) {
  const data = readJsonIfExists("blocklist.json");
  if (!data || !Array.isArray(data.items)) {
    console.log("[import-legacy] No data/blocklist.json found, skipping.");
    return;
  }
  let count = 0;
  for (const rawKw of data.items) {
    const keyword = String(rawKw || "").trim().toLowerCase();
    if (!keyword) continue;
    await db
      .insert(blocklist)
      .values({ keyword, reason: "Imported from legacy blocklist.json" })
      .onConflictDoNothing({ target: blocklist.keyword });
    count++;
  }
  console.log(`[import-legacy] Imported ${count} blocklist keywords.`);
}

async function importCustomChapters(db) {
  const data = readJsonIfExists("custom_chapters.json");
  if (!data || typeof data.chapters !== "object" || !data.chapters) {
    console.log("[import-legacy] No data/custom_chapters.json found, skipping.");
    return;
  }
  let mangaCount = 0;
  let chapterCount = 0;
  let pageCount = 0;

  for (const [rawSlug, chapterList] of Object.entries(data.chapters)) {
    const slug = String(rawSlug || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    if (!slug || !Array.isArray(chapterList)) continue;

    const prettyTitle = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    await db
      .insert(customManga)
      .values({
        slug,
        title: prettyTitle,
        synopsis: "Manga custom - diimpor dari data lama.",
        type: "Custom",
        status: "Ongoing",
      })
      .onConflictDoNothing({ target: customManga.slug });

    const [mangaRow] = await db
      .select()
      .from(customManga)
      .where(eq(customManga.slug, slug))
      .limit(1);

    if (!mangaRow) continue;
    mangaCount++;

    for (const ch of chapterList) {
      if (!ch?.id) continue;
      const chapterId = String(ch.id);
      const label = String(ch.label || "Chapter Custom").trim();
      const number = Number.isFinite(Number(ch.number)) ? Number(ch.number) : 0;
      const createdAt = ch.createdAt ? new Date(ch.createdAt) : new Date();

      await db
        .insert(customChapters)
        .values({
          id: chapterId,
          mangaId: mangaRow.id,
          slug,
          label,
          number,
          createdAt,
        })
        .onConflictDoUpdate({
          target: customChapters.id,
          set: { label, number },
        });
      chapterCount++;

      const images = Array.isArray(ch.images) ? ch.images : [];
      for (let idx = 0; idx < images.length; idx++) {
        const imageUrl = String(images[idx] || "").trim();
        if (!/^https?:\/\//i.test(imageUrl)) continue;
        await db
          .insert(customChapterPages)
          .values({
            chapterId,
            pageNumber: idx + 1,
            imageUrl,
          })
          .onConflictDoUpdate({
            target: [customChapterPages.chapterId, customChapterPages.pageNumber],
            set: { imageUrl },
          });
        pageCount++;
      }
    }
  }

  console.log(
    `[import-legacy] Imported ${mangaCount} custom manga, ${chapterCount} chapters, ${pageCount} pages.`
  );
}

async function main() {
  const db = getDb();
  await importAnnouncements(db);
  await importMaintenance(db);
  await importBlocklist(db);
  await importCustomChapters(db);
  console.log("[import-legacy] Legacy data migration completed.");
}

main().catch((err) => {
  console.error("[import-legacy] Error:", err);
  process.exit(1);
});

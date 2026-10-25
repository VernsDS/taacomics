import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "blocklist.json");

import { fetchPanelData } from "@/lib/adminData";

/** Keyword dari admin panel (remote) atau file lokal. */
export async function fetchBlocklistKeywords() {
  const panel = await fetchPanelData("/api/public/blocklist");
  if (panel && Array.isArray(panel.items)) {
    return panel.items.map((x) => String(x).toLowerCase()).filter(Boolean);
  }
  return readBlocklist();
}

/** Fungsi tetap sinkron (readBlocklist) untuk fallback lokal; integrasi utama pakai async di bawah. */
export function readBlocklist() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const items = Array.isArray(JSON.parse(raw)?.items) ? JSON.parse(raw).items : [];
    return items.map((x) => String(x).toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

export function writeBlocklist(items) {
  const clean = [...new Set(items.map((x) => String(x).trim()).filter(Boolean))];
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ items: clean }, null, 2), "utf8");
    return { ok: true };
  } catch (err) {
    return { ok: false, code: "READ_ONLY_FS", message: String(err?.message || err) };
  }
}

/** Filter daftar manga (MangaDex atau Komiku) berdasarkan kata/judul yang di-hide admin. */
export async function filterBlocked(list, getTitle) {
  const blocked = await fetchBlocklistKeywords();
  if (blocked.length === 0) return { items: Array.isArray(list) ? list : [], hidden: 0 };
  const items = (Array.isArray(list) ? list : []).filter((m) => {
    const title = String(getTitle(m) || "").toLowerCase();
    return !blocked.some((kw) => title.includes(kw));
  });
  return { items, hidden: (Array.isArray(list) ? list.length : 0) - items.length };
}

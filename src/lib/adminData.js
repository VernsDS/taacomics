/**
 * Pembaca data remote dari TaaComics Admin Panel (admin.taamanga.my.id).
 * Aktif hanya jika env ADMIN_PANEL_URL diset (mis. "https://admin.taamanga.my.id").
 * Semua fungsi mengembalikan null saat gagal / env kosong → pemanggil fallback ke data lokal.
 */
export const ADMIN_PANEL_URL = (process.env.ADMIN_PANEL_URL || "").replace(/\/+$/, "");

const cache = new Map(); // path -> { at, data }
const TTL_MS = 30_000; // cache pendek supaya server component tidak spam fetch

export async function fetchPanelData(pathname, { timeout = 8000, ttl = TTL_MS } = {}) {
  if (!ADMIN_PANEL_URL) return null;
  const key = `${ADMIN_PANEL_URL}${pathname}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.data;

  try {
    const res = await fetch(key, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

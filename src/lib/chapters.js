const BASE = "https://api.mangadex.org";
const UA = "TaaComics/2.0 (+https://taamanga.my.id)";

const LANG_ORDER = ["id", "en", "pt-br", "es", "ru", "vi", "tr", "zh-hk", "fr"];

function langPriority(lang) {
  const i = LANG_ORDER.indexOf(lang);
  return i === -1 ? LANG_ORDER.length : i;
}

export function mergeAndSortChapters(list) {
  const byKey = new Map();
  for (const ch of list || []) {
    const a = ch.attributes || {};
    const key = `${a.volume ?? "-"}|${a.chapter ?? a.title ?? ch.id}`;
    const prev = byKey.get(key);
    if (!prev || langPriority(a.translatedLanguage) < langPriority(prev.attributes?.translatedLanguage)) {
      byKey.set(key, ch);
    }
  }
  const num = (ch) => {
    const c = parseFloat(ch.attributes?.chapter);
    return Number.isNaN(c) ? Number.POSITIVE_INFINITY : c;
  };
  return [...byKey.values()].sort(
    (a, b) =>
      num(a) - num(b) ||
      (a.attributes?.translatedLanguage || "").localeCompare(b.attributes?.translatedLanguage || "")
  );
}

async function fetchFeedPages(mangaId, languages, maxPages) {
  const collected = [];
  const pageSize = 100;
  let offset = 0;
  let total = Infinity;

  for (let page = 0; page < maxPages && offset < total; page++) {
    const p = new URLSearchParams();
    p.append("limit", String(pageSize));
    p.append("offset", String(offset));
    for (const lang of languages) p.append("translatedLanguage[]", lang);
    p.append("order[chapter]", "asc");
    p.append("includes[]", "scanlation_group");

    const res = await fetch(`${BASE}/manga/${mangaId}/feed?${p}`, {
      headers: { "User-Agent": UA },
      next: { revalidate: 300 },
    });
    if (!res.ok) break;
    const data = await res.json();
    total = data.total || 0;
    const chunk = data.data || [];
    collected.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  return collected;
}

export async function fetchChaptersForManga(mangaId, { lang } = {}) {
  if (lang) {
    return fetchFeedPages(mangaId, [lang], 10);
  }

  const [primary, secondary] = await Promise.all([
    fetchFeedPages(mangaId, ["id", "en"], 10),
    fetchFeedPages(mangaId, ["pt-br", "es", "ru", "vi", "tr", "zh-hk", "fr"], 10),
  ]);

  return mergeAndSortChapters([...primary, ...secondary]);
}

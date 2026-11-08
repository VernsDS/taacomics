const BASE = "https://www.webtoons.com/id";
const UA = "TaaComics/2.0 (+https://taamanga.my.id)";

function decodeEntities(str) {
  const named = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };
  return String(str || "")
    .replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => named[m] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .trim();
}

async function getText(url, revalidateSec = 600) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      },
      next: { revalidate: revalidateSec },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export function parseSlug(rawSlug) {
  const s = String(rawSlug || "").replace(/\/+$/, "");
  const m = s.match(/-t(\d+)$/);
  if (!m) return null;
  const titleNo = Number(m[1]);
  const rest = s.slice(0, -m[1].length).replace(/-t$/, "");
  const parts = rest.split("-");
  if (parts.length < 2) return null;
  return { genre: parts[0], seriesSlug: parts.slice(1).join("-"), titleNo };
}

/* ---------- SEARCH ---------- */

const CARD_RE =
  /<a href="(https:\/\/www\.webtoons\.com\/id\/([a-z-]+)\/([a-z0-9-]+)\/list\?title_no=(\d+))"[^>]*class="[^"]*_card_item[^"]*"[^>]*>[\s\S]{0,1200}?<img[^>]+src="(https:\/\/webtoon-phinf\.pstatic\.net\/[^"]+)"[\s\S]{0,600}?<strong class="title">([\s\S]*?)<\/strong>(?:\s*<div class="author">([\s\S]*?)<\/div>)?/gi;

export async function searchWebtoons(q) {
  if (!q) return [];
  const html = await getText(`${BASE}/search?keyword=${encodeURIComponent(q)}`, 300);

  const items = [];
  let m;
  const seen = new Set();
  CARD_RE.lastIndex = 0;
  while ((m = CARD_RE.exec(html)) && items.length < 20) {
    const [, , genre, slug, titleNo, cover, rawTitle, rawAuthor] = m;
    if (seen.has(titleNo)) continue;
    seen.add(titleNo);
    items.push({
      source: "webtoons",
      title: decodeEntities(rawTitle.replace(/<[^>]+>/g, "")),
      author: rawAuthor ? decodeEntities(rawAuthor.replace(/<[^>]+>/g, "")) : "",
      slug: `${genre}-${slug}-t${titleNo}`,
      titleNo: Number(titleNo),
      cover: cover.replace(/&amp;/g, "&"),
      latestChapter: "Original Webtoon",
    });
  }
  return items;
}

/* ---------- DETAIL ---------- */

const EP_RE =
  /<li[^>]*class="[^"]*_episodeItem[^"]*"[^>]*data-episode-no="(\d+)"[\s\S]{0,2500}?href="(https:\/\/www\.webtoons\.com\/id\/[^"]+\/(episode-\d+)\/viewer\?title_no=\d+&(?:amp;)?episode_no=(\d+))"[\s\S]{0,2500}?<(?:strong|span) class="subj"[^>]*>([\s\S]*?)<\/(?:strong|span)>(?:[\s\S]{0,900}?<span class="date">([^<]*)<\/span>)?/gi;

function collectEpisodes(html) {
  const chapters = [];
  let m;
  const seen = new Set();
  EP_RE.lastIndex = 0;
  while ((m = EP_RE.exec(html))) {
    const seg = m[3];
    const epNo = Number(m[4]);
    if (seen.has(epNo)) continue;
    seen.add(epNo);
    chapters.push({
      epNo,
      seg,
      label: decodeEntities(m[5].replace(/<[^>]+>/g, "")),
      date: m[6] ? decodeEntities(m[6]) : "Episode webtoon",
      path: `chapter-${epNo}-${seg}`,
    });
  }
  return chapters.sort((a, b) => b.epNo - a.epNo);
}

function detailMeta(rawSlug, html) {
  const parsed = parseSlug(rawSlug) || {};
  const title = decodeEntities(
    ((html.match(/<h1 class="subj"[^>]*>([\s\S]*?)<\/h1>/) || [, ""])[1] || "").replace(/<[^>]+>/g, "")
  );
  const author = decodeEntities(
    ((html.match(/class="author(?:_region)?"[^>]*>([\s\S]*?)<\/(?:a|div|span|p)>/) || [, ""])[1] || "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s*\/\s*/g, " · ")
  );
  const summary = decodeEntities(
    ((html.match(/class="summary"[^>]*>([\s\S]*?)<\/(?:p|div)>/) || [, ""])[1] || "").replace(
      /<[^>]+>/g,
      ""
    )
  );
  const genreText = decodeEntities(
    ((html.match(/class="genre_item"[^>]*>\s*([a-z-]+)\s*</i) || [, ""])[1] || "").replace(/-/g, " ")
  );
  const cover =
    (html.match(/class="detail_pic"[\s\S]{0,400}?<img[^>]+src="(https:\/\/[^"]+)"/) || [, ""])[1] || "";
  const rating = (html.match(/point_area[^>]*>\s*(\d[\d.]*)/) || [])[1] || null;
  return {
    source: "webtoons",
    slug: rawSlug,
    titleNo: parsed.titleNo,
    title: title || rawSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    author,
    cover: cover.replace(/&amp;/g, "&"),
    synopsis: summary,
    genre: genreText,
    rating,
  };
}

export async function getWebtoonsDetail(rawSlug) {
  const parsed = parseSlug(rawSlug);
  if (!parsed) throw new Error("slug webtoons tidak valid - harus diakhiri -t<titleNo>");
  const { genre, seriesSlug, titleNo } = parsed;

  const html = await getText(`${BASE}/${genre}/${seriesSlug}/list?title_no=${titleNo}`, 600);
  const chapters = collectEpisodes(html);

  if (chapters.length === 0 && html.length < 2000) throw new Error("webtoon tidak ditemukan");

  const meta = detailMeta(rawSlug, html);
  return {
    ...meta,
    chapterList: chapters,
    chapterCount: chapters.length,
    truncated: chapters.length > 0,
    first: chapters.length ? chapters[chapters.length - 1] : null,
    latest: chapters.length ? chapters[0] : null,
  };
}

/* ---------- EPISODE (viewer) ---------- */

const PREV_RE = /<a\b[^>]*href="([^"]+\/viewer\?title_no=\d+&(?:amp;)?episode_no=(\d+))"[^>]*_prevEpisode[^>]*>/i;
const NEXT_RE = /<a\b[^>]*href="([^"]+\/viewer\?title_no=\d+&(?:amp;)?episode_no=(\d+))"[^>]*_nextEpisode[^>]*>/i;
const IMG_RE = /<img[^>]+class="[^"]*_images[^"]*"[^>]+data-url="([^"]+)"/g;

export async function getWebtoonsEpisode(rawSlug, chapterParam) {
  const parsed = parseSlug(rawSlug);
  if (!parsed) throw new Error("slug webtoons tidak valid");
  const { genre, seriesSlug, titleNo } = parsed;

  let epNo;
  let seg;
  const cm = String(chapterParam || "").match(/^chapter-(\d+)-(episode-\d+)$/);
  if (cm) {
    epNo = Number(cm[1]);
    seg = cm[2];
  } else {
    epNo = Number(String(chapterParam || "").replace(/\D/g, ""));
    seg = `episode-${epNo}`;
  }
  if (!epNo) throw new Error("nomor episode tidak valid");

  const html = await getText(
    `${BASE}/${genre}/${seriesSlug}/${seg}/viewer?title_no=${titleNo}&episode_no=${epNo}`,
    3600
  );

  const epTitle = decodeEntities(
    ((html.match(/<h1 class="subj_episode"[^>]*>([\s\S]*?)<\/h1>/) || [, ""])[1] || "").replace(
      /<[^>]+>/g,
      ""
    )
  );
  const seriesTitle = decodeEntities(
    ((html.match(/<h2[^>]*class="subj"[^>]*>([\s\S]*?)<\/h2>/) || [, ""])[1] || "").replace(
      /<[^>]+>/g,
      ""
    )
  );
  const title = `${seriesTitle || "Webtoon"} · ${epTitle || `Episode ${epNo}`}`;

  const images = [];
  const seen = new Set();
  let m;
  IMG_RE.lastIndex = 0;
  while ((m = IMG_RE.exec(html))) {
    const url = m[1].replace(/&amp;/g, "&");
    if (seen.has(url)) continue;
    seen.add(url);
    if (/id_warning\.png/i.test(url)) continue;
    images.push(url);
  }
  if (images.length === 0) throw new Error("tidak ada halaman gambar pada episode ini");

  let prev = null;
  let next = null;
  const pv = PREV_RE.exec(html);
  if (pv)
    prev = {
      epNo: Number(pv[2]),
      seg: (pv[1].match(/\/(episode-\d+)\/viewer/) || [, null])[1] || `episode-${pv[2]}`,
    };
  const nx = NEXT_RE.exec(html);
  if (nx)
    next = {
      epNo: Number(nx[2]),
      seg: (nx[1].match(/\/(episode-\d+)\/viewer/) || [, null])[1] || `episode-${nx[2]}`,
    };

  return { title, images, prev, next };
}

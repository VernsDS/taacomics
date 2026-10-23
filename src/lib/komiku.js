/**
 * Komiku.org mirror scraper untuk TaaComics.
 * Struktur terverifikasi 2026:
 * - Search fragment: https://api.komiku.org/manga/?post_type=manga&s=<q> (.bge cards)
 * - Detail: https://komiku.org/manga/<slug>/ (cover .ims img, judul inftable, p.desc, td.judulseries/tanggalseries)
 * - Chapter: https://komiku.org/<chapter-slug>/ (img.komiku.org/uploads2/*, nav .nextch/.prevch data="url")
 */
const UA = "TaaComics/1.0 (+https://ataamanga.web.id)";
const SITE = "https://komiku.org";
const API = "https://api.komiku.org";

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#038;|&#38;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&hellip;/g, "…");
}

async function getText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Referer: SITE + "/" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`komiku ${res.status} untuk ${url}`);
  return res.text();
}

/** Search: return {slug, title, cover, latest}[] */
export async function searchKomiku(q) {
  const query = String(q || "").trim();
  if (!query) return [];
  const html = await getText(`${API}/manga/?post_type=manga&s=${encodeURIComponent(query)}`);
  const blocks = html.split('<div class="bge">').slice(1);
  const items = [];
  for (const block of blocks) {
    const href = block.match(/<a[^>]+href="\/manga\/([^/"]+)\/"/);
    const title = block.match(/<h3>([^<]+)<\/h3>/);
    if (!href || !title) continue;
    const img = block.match(/<img[^>]+src="([^"]+)"/);
    const latest = block.match(/<span>Terbaru:\s*<\/span>\s*<span>([^<]+)<\/span>/);
    const updateAt = block.match(/<p>\s*Update ([^<]+)\./);
    items.push({
      slug: href[1],
      title: decodeEntities(title[1]).trim(),
      cover: img ? decodeEntities(img[1]) : null,
      latestChapter: latest ? decodeEntities(latest[1]).trim() : null,
      updatedAt: updateAt ? decodeEntities(updateAt[1]).trim() : null,
    });
    if (items.length >= 24) break;
  }
  return items;
}

/** Detail + daftar chapter */
export async function getKomikuDetail(slug) {
  const clean = decodeURIComponent(String(slug)).replace(/[^a-z0-9-]/gi, "");
  const html = await getText(`${SITE}/manga/${clean}/`);

  const titleM =
    html.match(/data-series-title="([^"]+)"/) ||
    html.match(/<tr><td>Judul:<\/td><td[^>]*>([^<]+)<\/td><\/tr>/) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const coverM = html.match(/<div class="ims">\s*<img[^>]+src="([^"]+)"/);
  const descM = html.match(/<p class="desc"[^>]*>([\s\S]*?)<\/p>/);
  const typeM = html.match(/<tr><td>Tipe:<\/td><td[^>]*>\s*<strong>([^<]+)<\/strong>/);
  const statusM = html.match(/<tr><td>Status<\/td><td[^>]*>([^<]+)<\/td><\/tr>/) || html.match(/<tr><td>Status:<\/td><td[^>]*>([^<]+)<\/td><\/tr>/);
  const altM = html.match(/<tr><td>Judul Alternatif:<\/td><td[^>]*>([^<]+)<\/td><\/tr>/);

  const genres = [];
  for (const m of html.matchAll(/<li class="genre"><a href="\/genre\/[^"]+"[^>]*><span>([^<]+)<\/span>/g)) {
    genres.push(decodeEntities(m[1]).trim());
  }

  // Chapter rows: judulseries (href + <b>Chapter N</b>) + tanggalseries (tanggal)
  const chapters = [];
  const rowRe = /<td class="judulseries">[\s\S]{0,300}?href="([^"]+)"[\s\S]{0,300}?<b>([^<]+)<\/b>[\s\S]{0,300}?<\/td>\s*<td class="tanggalseries">([^<]*)<\/td>/g;
  for (const m of html.matchAll(rowRe)) {
    const chapterPath = m[1].startsWith("http") ? new URL(m[1]).pathname : m[1];
    const label = decodeEntities(m[2]).trim();
    const num = parseFloat(label.replace(/[^\d.]/g, ""));
    chapters.push({
      path: chapterPath.replace(/^\/|\/$/g, ""), // simpan tanpa slash untuk routing Bersih
      label,
      number: Number.isFinite(num) ? num : null,
      date: decodeEntities(m[3]).trim(),
    });
  }

  if (!titleM && chapters.length === 0) throw new Error("komiku detail tidak ditemukan");

  return {
    slug: clean,
    title: titleM ? decodeEntities(titleM[1]).trim() : clean.replace(/-/g, " "),
    altTitle: altM ? decodeEntities(altM[1]).trim() : null,
    cover: coverM ? decodeEntities(coverM[1]) : null,
    synopsis: descM ? decodeEntities(descM[1]).replace(/<[^>]+>/g, "").trim() : "",
    type: typeM ? decodeEntities(typeM[1]).trim() : null,
    status: statusM ? decodeEntities(statusM[1]).trim() : null,
    genres,
    chapterCount: chapters.length,
    first: chapters.length ? chapters[chapters.length - 1] : null,
    latest: chapters.length ? chapters[0] : null,
    chapters,
  };
}

/** Daftar gambar + navigasi prev/next dari halaman chapter */
export async function getKomikuChapter(chapterPath) {
  const path = String(chapterPath).replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9-]/gi, "");
  if (!path) throw new Error("chapter tidak valid");
  const html = await getText(`${SITE}/${path}/`);

  const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = titleM ? decodeEntities(titleM[1]).replace(/<[^>]+>/g, "").trim() : path.replace(/-/g, " ");

  const images = [];
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    let src = decodeEntities(m[1]).trim();
    if (src.startsWith("//")) src = "https:" + src;
    if (src.startsWith("/")) src = SITE + src;
    if (!/^https:\/\//.test(src)) continue;
    if (/\/asset\/|promosi|logo|icon|faq|wppage|source_WP|comment|avatar|reaction|emoji/i.test(src)) continue;
    if (!/uploads|img\.komiku|komkumid|komiku/i.test(src)) continue;
    if (images.includes(src)) continue;
    images.push(src);
    if (images.length >= 120) break;
  }

  let prev = null;
  let next = null;
  for (const m of html.matchAll(/<div class="(prevch|nextch)"[^>]*data="([^"]+)"/g)) {
    if (m[1] === "prevch") prev = m[2];
    else next = m[2];
  }

  if (images.length === 0) throw new Error("gambar chapter tidak ditemukan");

  return { title, images, prev, next };
}

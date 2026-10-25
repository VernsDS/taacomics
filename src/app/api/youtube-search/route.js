import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Cache-Control": "no-store",
};

function corsJson(body, init = {}) {
  return NextResponse.json(body, { ...init, headers: { ...CORS_HEADERS, ...(init.headers || {}) } });
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/**
 * Ambil hasil pencarian YouTube dari halaman results (tanpa API key).
 * Ekstrak field videoRenderer: videoId, title, author, durasi, views, published.
 */
export async function searchYouTube(q, limit = 20) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D&hl=id`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`YouTube responded ${res.status}`);
  const html = await res.text();

  const results = [];
  const marker = '"videoRenderer":{"videoId":"';
  let idx = html.indexOf(marker);
  while (idx !== -1 && results.length < limit) {
    const start = idx + marker.length;
    const videoId = html.slice(start, start + 11).split('"')[0];
    const end = html.indexOf(marker, start);
    const chunk = html.slice(start, end === -1 ? start + 6000 : end);

    if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      const titleM = chunk.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
      const authorM =
        chunk.match(/"ownerText":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/) ||
        chunk.match(/"longBylineText":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
      const durationM = chunk.match(/"lengthText":\{[^}]*"simpleText":"([\d:]+)"/);
      const viewsM = chunk.match(/"viewCountText":\{"simpleText":"((?:[^"\\]|\\.)*)"/);
      const publishedM = chunk.match(/"publishedTimeText":\{"simpleText":"((?:[^"\\]|\\.)*)"/);

      if (titleM) {
        // durasi "3:12" / "1:03:04" → detik
        let duration = 0;
        if (durationM) {
          duration = durationM[1]
            .split(":")
            .reverse()
            .reduce((acc, part, i) => acc + Number(part) * 60 ** i, 0);
        }
        results.push({
          id: videoId,
          title: decodeEntities(titleM[1]),
          author: authorM ? decodeEntities(authorM[1]) : "YouTube",
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          duration,
          duration_timestamp: durationM ? durationM[1] : "",
          views: viewsM ? decodeEntities(viewsM[1]) : "",
          published: publishedM ? decodeEntities(publishedM[1]) : "",
        });
      }
    }
    idx = end;
  }
  return results;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    return corsJson({ status: false, error: "q wajib diisi", results: [], resultCount: 0 });
  }

  try {
    const results = await searchYouTube(q, 20);
    return corsJson({
      status: results.length > 0,
      query: q,
      results,
      resultCount: results.length,
      message: results.length === 0 ? "Tidak ada hasil" : undefined,
    });
  } catch (e) {
    return corsJson(
      { status: false, error: e.message, query: q, results: [], resultCount: 0 },
      { status: 200 }
    );
  }
}

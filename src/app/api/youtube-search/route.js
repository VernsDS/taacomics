import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/security";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

function corsJson(body, request, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...getCorsHeaders(request, "GET, OPTIONS"),
      ...(init.headers || {}),
    },
  });
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

export async function searchYouTube(query, limit = 20) {
  const url =
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` +
    "&sp=EgIQAQ%253D%253D&hl=id";

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`YouTube responded ${response.status}`);
  }

  const html = await response.text();
  const results = [];
  const marker = '"videoRenderer":{"videoId":"';
  let index = html.indexOf(marker);

  while (index !== -1 && results.length < limit) {
    const start = index + marker.length;
    const videoId = html.slice(start, start + 11).split('"')[0];
    const end = html.indexOf(marker, start);
    const chunk = html.slice(start, end === -1 ? start + 6000 : end);

    if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      const titleMatch = chunk.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
      const authorMatch =
        chunk.match(/"ownerText":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/) ||
        chunk.match(/"longBylineText":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
      const durationMatch = chunk.match(/"lengthText":\{[^}]*"simpleText":"([\d:]+)"/);
      const viewsMatch = chunk.match(/"viewCountText":\{"simpleText":"((?:[^"\\]|\\.)*)"/);
      const publishedMatch = chunk.match(/"publishedTimeText":\{"simpleText":"((?:[^"\\]|\\.)*)"/);

      if (titleMatch) {
        const duration = durationMatch
          ? durationMatch[1]
              .split(":")
              .reverse()
              .reduce((total, part, position) => total + Number(part) * 60 ** position, 0)
          : 0;

        results.push({
          id: videoId,
          title: decodeEntities(titleMatch[1]),
          author: authorMatch ? decodeEntities(authorMatch[1]) : "YouTube",
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          duration,
          duration_timestamp: durationMatch ? durationMatch[1] : "",
          views: viewsMatch ? decodeEntities(viewsMatch[1]) : "",
          published: publishedMatch ? decodeEntities(publishedMatch[1]) : "",
        });
      }
    }

    index = end;
  }

  return results;
}

export function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request, "GET, OPTIONS"),
  });
}

export async function GET(request) {
  const corsHeaders = getCorsHeaders(request, "GET, OPTIONS");
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim().slice(0, 100);

  if (!query) {
    return corsJson(
      { status: false, error: "q wajib diisi", results: [], resultCount: 0 },
      request,
      { status: 400 }
    );
  }

  try {
    const rateLimit = await checkRateLimit(request, {
      scope: "youtube_search",
      limit: 30,
      window: "1 m",
    });

    if (!rateLimit.success) {
      return corsJson(
        {
          status: false,
          error: "Terlalu banyak pencarian. Coba lagi sebentar.",
          results: [],
          resultCount: 0,
        },
        request,
        { status: 429, headers: rateLimit.headers }
      );
    }

    const results = await searchYouTube(query, 20);

    return corsJson(
      {
        status: results.length > 0,
        query,
        results,
        resultCount: results.length,
        message: results.length === 0 ? "Tidak ada hasil" : undefined,
      },
      request,
      { headers: rateLimit.headers }
    );
  } catch (error) {
    console.error("[youtube-search] failed:", error);

    // Match the live version's response contract: return JSON with HTTP 200
    // so the existing MusicPlayer can display the error without throwing.
    return corsJson(
      {
        status: false,
        error: error?.message || "YouTube search failed",
        query,
        results: [],
        resultCount: 0,
      },
      request,
      { status: 200 }
    );
  }
}

export const runtime = "edge";

// Allowed domains for manga page images
const ALLOWED = [
  "uploads.mangadex.org",
  "mangadex.network",
  "cmdxd98sb0x3yprd.mangadex.network",
  // Komiku mirror (img.komiku.org, thumbnail.komiku.org/.to, update.komikid.org)
  "komiku.org",
  "komiku.to",
  "komikid.org",
  "pstatic.net",
];

function isAllowed(url) {
  try {
    const { hostname } = new URL(url);
    return ALLOWED.some((d) => hostname === d || hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url || !isAllowed(url)) {
    return new Response("Invalid URL", { status: 400 });
  }

  try {
    let referer = "https://mangadex.org";
    try {
      const { hostname } = new URL(url);
      if (/(komiku|komikid)/.test(hostname)) referer = "https://komiku.org/";
      else if (/pstatic\.net$/.test(hostname)) referer = "https://www.webtoons.com/";
    } catch {}

    const response = await fetch(url, {
      headers: {
        "User-Agent": "TaaComics/1.0",
        Referer: referer,
      },
    });

    if (!response.ok) {
      return new Response("Failed to fetch image", { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        // CORS headers so canvas can read pixels
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response("Proxy error", { status: 500 });
  }
}


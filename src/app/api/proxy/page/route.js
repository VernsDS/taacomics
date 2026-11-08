import { isAllowedCustomImageUrl, getCorsHeaders, USER_AGENT } from "@/lib/security";

export const runtime = "edge";

export async function GET(request) {
  const corsHeaders = getCorsHeaders(request, "GET, OPTIONS");
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url || !isAllowedCustomImageUrl(url)) {
    return new Response("Invalid or disallowed image URL", { status: 400, headers: corsHeaders });
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
        "User-Agent": USER_AGENT,
        Referer: referer,
      },
      redirect: "error",
    });

    if (!response.ok) {
      return new Response("Failed to fetch image", { status: response.status, headers: corsHeaders });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch {
    return new Response("Proxy error", { status: 500, headers: corsHeaders });
  }
}

import { getCorsHeaders, USER_AGENT } from "@/lib/security";

export const runtime = "edge";

export async function GET(request) {
  const corsHeaders = getCorsHeaders(request, "GET, OPTIONS");
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  let parsed;
  try {
    parsed = new URL(rawUrl || "");
  } catch {
    return new Response("Invalid URL", { status: 400, headers: corsHeaders });
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== "uploads.mangadex.org" ||
    parsed.username ||
    parsed.password
  ) {
    return new Response("Invalid URL", { status: 400, headers: corsHeaders });
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: "https://mangadex.org",
      },
      redirect: "error",
    });

    if (!response.ok) {
      return new Response("Failed to fetch image", {
        status: response.status,
        headers: corsHeaders,
      });
    }

    return new Response(await response.arrayBuffer(), {
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[cover-proxy] upstream request failed:", error);
    return new Response("Error fetching image", { status: 502, headers: corsHeaders });
  }
}

export function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request, "GET, OPTIONS"),
  });
}

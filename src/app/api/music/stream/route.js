import { NextResponse } from "next/server";
import { getCorsHeaders, USER_AGENT } from "@/lib/security";
import { validateSafeAudioUrl } from "@/lib/security-node";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const FORWARDED_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges"];

function buildResponseHeaders(upstream, request, rlHeaders = {}) {
  const headers = new Headers({
    ...getCorsHeaders(request, "GET, OPTIONS"),
    ...rlHeaders,
  });

  FORWARDED_HEADERS.forEach((name) => {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  });

  if (!headers.has("content-type")) headers.set("content-type", "audio/mpeg");
  headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");

  return headers;
}

export function OPTIONS(request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request, "GET, OPTIONS"),
  });
}

export async function GET(request) {
  const corsHeaders = getCorsHeaders(request, "GET, OPTIONS");

  try {
    const rl = await checkRateLimit(request, {
      scope: "music_stream",
      limit: 60,
      window: "1 m",
    });

    if (!rl.success) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan streaming audio." },
        { status: 429, headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    const { searchParams } = new URL(request.url);
    const audioUrl = searchParams.get("url") || "";

    const safety = await validateSafeAudioUrl(audioUrl);
    if (!safety.ok) {
      return NextResponse.json(
        { error: safety.error },
        { status: 400, headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    const range = request.headers.get("range");
    const upstream = await fetch(safety.url, {
      headers: {
        Accept: "audio/*,*/*;q=0.8",
        "User-Agent": USER_AGENT,
        ...(range ? { Range: range } : {}),
      },
      redirect: "manual", // Prevent open-redirect SSRF bypass
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    // If upstream issues a redirect, validate the redirect target before following
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (!location) {
        return NextResponse.json(
          { error: "Invalid upstream redirect" },
          { status: 502, headers: { ...corsHeaders, ...rl.headers } }
        );
      }
      const nextUrl = new URL(location, safety.url).toString();
      const redirectSafety = await validateSafeAudioUrl(nextUrl);
      if (!redirectSafety.ok) {
        return NextResponse.json(
          { error: `Redirect blocked: ${redirectSafety.error}` },
          { status: 403, headers: { ...corsHeaders, ...rl.headers } }
        );
      }
      const followed = await fetch(redirectSafety.url, {
        headers: {
          Accept: "audio/*,*/*;q=0.8",
          "User-Agent": USER_AGENT,
          ...(range ? { Range: range } : {}),
        },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });

      if (!followed.ok && followed.status !== 206) {
        return NextResponse.json(
          { error: `Audio source responded ${followed.status}` },
          { status: 502, headers: { ...corsHeaders, ...rl.headers } }
        );
      }

      return new Response(followed.body, {
        status: followed.status,
        statusText: followed.statusText,
        headers: buildResponseHeaders(followed, request, rl.headers),
      });
    }

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Audio source responded ${upstream.status}` },
        { status: 502, headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: buildResponseHeaders(upstream, request, rl.headers),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Stream proxy error" },
      { status: 502, headers: corsHeaders }
    );
  }
}

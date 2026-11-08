import { NextResponse } from "next/server";
import { getCorsHeaders, USER_AGENT } from "@/lib/security";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const FAA_YTPLAY_URL = "https://api-faa.my.id/faa/ytplay";
const DEFAULT_QUERY = "Inni uhibbuka";

function proxiedAudioUrl(url) {
  if (!url) return "";
  return `/api/music/stream?url=${encodeURIComponent(url)}`;
}

function normalizeTrack(raw) {
  if (!raw || typeof raw !== "object") return null;

  const track = raw.result && typeof raw.result === "object" ? raw.result : raw;

  const mp3 =
    track.mp3 ||
    track.audio ||
    track.audioUrl ||
    track.audio_url ||
    track.play ||
    track.download ||
    track.dl ||
    track.url_mp3 ||
    "";

  if (!mp3 || typeof mp3 !== "string" || !mp3.startsWith("https://")) return null;

  const title = track.title || track.name || track.trackName || "Unknown Track";
  const author = track.author || track.artist || track.channel || track.artistName || "Unknown Artist";
  const thumbnail = track.thumbnail || track.thumb || track.image || track.cover || "/favicon.png";
  const duration = Number(track.duration) || 0;

  return {
    title,
    author,
    thumbnail,
    duration,
    duration_timestamp: track.duration_timestamp || track.timestamp || "",
    views: Number(track.views) || 0,
    published: track.published || track.ago || "",
    url: track.url || track.videoUrl || "",
    mp3,
    streamUrl: proxiedAudioUrl(mp3),
    trackName: title,
    artistName: author,
    artworkUrl100: thumbnail,
    previewUrl: proxiedAudioUrl(mp3),
    originalPreviewUrl: mp3,
    trackTimeMillis: duration * 1000,
  };
}

async function fetchFaaMusic(query) {
  const url = new URL(FAA_YTPLAY_URL);
  url.searchParams.set("query", query);

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": USER_AGENT,
    },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(15000),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Faa API responded ${res.status}: ${text.slice(0, 120)}`);

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Faa API returned non-JSON response");
  }
}

export function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request, "GET, OPTIONS"),
  });
}

export async function GET(request) {
  const corsHeaders = getCorsHeaders(request, "GET, OPTIONS");

  try {
    const rl = await checkRateLimit(request, {
      scope: "music_resolve",
      limit: 30,
      window: "1 m",
    });

    if (!rl.success) {
      return NextResponse.json(
        { status: false, error: "Rate limit exceeded", results: [], resultCount: 0 },
        { status: 429, headers: { ...corsHeaders, ...rl.headers } }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || DEFAULT_QUERY).trim().slice(0, 120) || DEFAULT_QUERY;

    const data = await fetchFaaMusic(q);
    const track = normalizeTrack(data);
    const results = track ? [track] : [];

    return NextResponse.json(
      {
        status: Boolean(track),
        creator: data?.creator || "Faa",
        query: q,
        result: track,
        results,
        resultCount: results.length,
        message: track ? undefined : "No playable mp3 URL found",
      },
      {
        headers: {
          ...corsHeaders,
          ...rl.headers,
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      { status: false, error: e.message, results: [], resultCount: 0 },
      { status: 502, headers: corsHeaders }
    );
  }
}

import { NextResponse } from "next/server";

const FAA_YTPLAY_URL = "https://api-faa.my.id/faa/ytplay";
const DEFAULT_QUERY = "Inni uhibbuka";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Cache-Control": "no-store",
};

function corsJson(body, init = {}) {
  return NextResponse.json(body, { ...init, headers: { ...CORS_HEADERS, ...(init.headers || {}) } });
}

function proxiedAudioUrl(url) {
  if (!url) return "";
  return `/api/music/stream?url=${encodeURIComponent(url)}`;
}

function normalizeTrack(raw) {
  if (!raw || typeof raw !== "object") return null;

  // Support both flat result and nested result.result
  const track = raw.result && typeof raw.result === "object" ? raw.result : raw;

  const mp3 =
    track.mp3 || track.audio || track.audioUrl || track.audio_url ||
    track.play || track.download || track.dl || track.url_mp3 || "";

  if (!mp3 || typeof mp3 !== "string" || !mp3.startsWith("http")) return null;

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
    // legacy aliases kept for compatibility
    trackName: title,
    artistName: author,
    artworkUrl100: thumbnail,
    previewUrl: proxiedAudioUrl(mp3),
    originalPreviewUrl: mp3,
    trackTimeMillis: duration * 1000,
  };
}

/**
 * Track dari fallback alternatif: kita membangun shape-nya sendiri dari
 * hasil provider (url audio + metadata) supaya bentuknya identik dengan faa.
 */
function buildFallbackTrack({ audioUrl, title, author, thumbnail, duration, seconds, videoId, source }) {
  if (!audioUrl || typeof audioUrl !== "string" || !audioUrl.startsWith("http")) return null;
  const dur = duration || seconds || 0;
  const mins = Math.floor(dur / 60);
  const secs = Math.floor(dur % 60);
  const thumb = thumbnail || `https://i.ytimg.com/vi/${videoId}/hq720.jpg`;
  const t = {
    title: title || "Unknown Track",
    author: author || "YouTube",
    thumbnail: thumb,
    duration: Math.round(dur),
    duration_timestamp: dur ? `${mins}:${String(secs).padStart(2, "0")}` : "",
    views: 0,
    published: "",
    url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
    mp3: audioUrl,
    streamUrl: proxiedAudioUrl(audioUrl),
    trackName: title || "Unknown Track",
    artistName: author || "YouTube",
    artworkUrl100: thumb,
    previewUrl: proxiedAudioUrl(audioUrl),
    originalPreviewUrl: audioUrl,
    trackTimeMillis: Math.round(dur * 1000),
  };
  t.source = source;
  return t;
}

/* ---------- Provider 1: faa ---------- */
async function fetchFaaMusic(query) {
  const url = new URL(FAA_YTPLAY_URL);
  url.searchParams.set("query", query);

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "TaaComics/1.0 (+https://ataamanga.web.id)"
    },
    cache: "no-store",
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

/* ---------- Provider 2 (fallback): Azbry / api.azbry.com ---------- */
async function fetchAzbryMusic(videoId) {
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  const res = await fetch(`https://api.azbry.com/api/download/ytmp3?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return null;
  const j = await res.json();
  const r = j?.result || {};
  // Azbry: result.url = link watch YouTube, audio asli di result.download
  const audio = (typeof r.download === "string" && /\.(mp3|m4a)/i.test(r.download)) ? r.download : (typeof r.download === "string" && r.download.startsWith("http") && !r.download.includes("youtube.com/watch")) ? r.download : null;
  return buildFallbackTrack({
    audioUrl: audio,
    title: r.title,
    author: r.channel === "Unknown" ? undefined : r.channel,
    thumbnail: r.thumbnail,
    duration: Number(r.duration) || 0,
    videoId: r.videoId || videoId,
    source: "azbry",
  });
}

/* ---------- Provider 3 (fallback): YTMP3.GE ---------- */
async function fetchYtmp3GeMusic(videoId) {
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  const res = await fetch("https://ytmp3.ge/api/convert", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" },
    body: new URLSearchParams({ youtube_url: `https://www.youtube.com/watch?v=${videoId}`, quality: "128" }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(40000),
  });
  if (!res.ok) return null;
  const j = await res.json();
  if (!j?.success || !j.downloadUrl) return null;
  return buildFallbackTrack({
    audioUrl: j.downloadUrl,
    title: j.title,
    thumbnail: j.thumbnail,
    videoId,
    source: "ytmp3ge",
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim() || DEFAULT_QUERY;
  const v = (searchParams.get("v") || "").trim();

  try {
    const data = await fetchFaaMusic(q);
    const track = normalizeTrack(data);
    if (track) {
      return corsJson({
        status: true,
        creator: data?.creator || "Faa",
        query: q,
        result: track,
        results: [track],
        resultCount: 1,
      });
    }
    throw new Error("Faa API returned no playable mp3 URL");
  } catch (e) {
    // Fallback 1: Azbry, Fallback 2: YTMP3.GE dua-duanya bisa denyut dari IP datacenter (Vercel)
    if (v) {
      for (const [name, fn] of [["azbry", fetchAzbryMusic], ["ytmp3ge", fetchYtmp3GeMusic]]) {
        let track = null;
        try {
          track = await fn(v);
        } catch (err2) {
          continue;
        }
        if (track) {
          return corsJson({
            status: true,
            creator: name,
            query: q,
            source: `fallback-${name}`,
            result: track,
            results: [track],
            resultCount: 1,
          });
        }
      }
      return corsJson(
        { status: false, source: "all-fallbacks-failed", faaError: e.message, error: "Semua provider fallback gagal", query: q, results: [], resultCount: 0 },
        { status: 200 }
      );
    }
    return corsJson(
      { status: false, error: e.message, query: q, results: [], resultCount: 0 },
      { status: 200 }
    );
  }
}

import { NextResponse } from "next/server";

export async function GET(request) {
  const u = new URL(request.url).searchParams;
  const v = u.get("v") || "i2woCepOTBI";
  const watch = `https://www.youtube.com/watch?v=${v}`;
  const out = { videoId: v, checks: {} };
  const add = async (name, fn) => {
    try { out.checks[name] = await fn(); } catch (e) { out.checks[name] = { error: String(e.message || e).slice(0, 120) }; }
  };

  await add("ytmp3ge", async () => {
    const res = await fetch("https://ytmp3.ge/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" },
      body: new URLSearchParams({ youtube_url: watch, quality: "128" }).toString(),
      cache: "no-store", signal: AbortSignal.timeout(30000),
    });
    const t = await res.text();
    return { httpStatus: res.status, body: t.slice(0, 300) };
  });

  await add("azbry-ytplay", async () => {
    const res = await fetch(`https://api.azbry.com/api/download/ytplay?url=${encodeURIComponent(watch)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store", signal: AbortSignal.timeout(30000),
    });
    const t = await res.text();
    return { httpStatus: res.status, body: t.slice(0, 300) };
  });

  await add("onlym-ytplay3", async () => {
    const res = await fetch(`https://onlym.my.id/download/ytplay3?url=${encodeURIComponent(watch)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store", signal: AbortSignal.timeout(30000),
    });
    const t = await res.text();
    return { httpStatus: res.status, body: t.slice(0, 300) };
  });

  await add("azbry-nodocs", async () => {
    const res = await fetch(`https://api.azbry.com/api/download/ytmp3?url=${encodeURIComponent(watch)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store", signal: AbortSignal.timeout(30000),
    });
    const t = await res.text();
    return { httpStatus: res.status, body: t.slice(0, 300) };
  });

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}

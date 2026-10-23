import { NextResponse } from "next/server";

const BASE = "https://api.mangadex.org";
const FALLBACK_BASE = "https://uploads.mangadex.org";

export async function GET(_, { params }) {
  try {
    const { id } = await params;
    const res = await fetch(`${BASE}/at-home/server/${id}`, {
      headers: { "User-Agent": "TaaComics/1.0 (+https://ataamanga.web.id)" },
      cache: "no-store",
    });
    const data = await res.json();

    if (data?.chapter && !data.chapter.baseUrl) {
      data.chapter.baseUrl = FALLBACK_BASE;
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

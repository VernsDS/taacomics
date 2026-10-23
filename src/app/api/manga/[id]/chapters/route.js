import { NextResponse } from "next/server";
import { mergeAndSortChapters, fetchChaptersForManga } from "@/lib/chapters";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get("lang");

    const total = await fetchChaptersForManga(id, { lang });

    return NextResponse.json({
      result: "ok",
      response: "collection",
      data: total,
      total: total.length,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

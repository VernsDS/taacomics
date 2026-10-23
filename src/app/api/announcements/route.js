import { NextResponse } from "next/server";
import { readAnnouncements } from "@/lib/announcementsStore";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await readAnnouncements();
    const items = data.items
      .filter((it) => it.active)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(({ id, title, body, level, createdAt }) => ({ id, title, body, level, createdAt }));
    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json({ ok: true, items: [] });
  }
}

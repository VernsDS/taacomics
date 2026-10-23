import { NextResponse } from "next/server";
import { readMaintenance } from "@/lib/siteStatus";

export const runtime = "nodejs";

export async function GET() {
  const { enabled, message } = await readMaintenance();
  return NextResponse.json({ ok: true, maintenance: enabled, message });
}

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getActiveAdminSession, requireAdminMutationAuth } from "@/lib/adminAuth";
import { readMaintenance, writeMaintenance } from "@/lib/siteStatus";

export const runtime = "nodejs";
export const MAINT_COOKIE_NAME = "taacomics_maint";

export async function GET() {
  const session = await getActiveAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const status = await readMaintenance();
  return NextResponse.json({ ok: true, ...status });
}

export async function POST(request) {
  const auth = await requireAdminMutationAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const res = await writeMaintenance(body?.enabled, body?.message);

  revalidatePath("/");
  revalidatePath("/maintenance");
  revalidatePath("/api/site-status");

  return NextResponse.json(res);
}

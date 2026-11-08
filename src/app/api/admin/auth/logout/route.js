import { NextResponse } from "next/server";
import {
  requireAdminMutationAuth,
  revokeAdminSessionByCookie,
  clearAdminAuthCookies,
} from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(request) {
  const auth = await requireAdminMutationAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  await revokeAdminSessionByCookie();
  const response = NextResponse.json({ ok: true });
  clearAdminAuthCookies(response);
  return response;
}

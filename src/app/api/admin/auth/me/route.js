import { NextResponse } from "next/server";
import { getActiveAdminSession } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getActiveAdminSession();
    if (!session) {
      return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
    }
    return NextResponse.json({
      ok: true,
      authenticated: true,
      user: session.user,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, authenticated: false, error: err.message },
      { status: 500 }
    );
  }
}

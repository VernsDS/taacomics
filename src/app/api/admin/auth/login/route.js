import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { adminUsers } from "@/db/schema";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  verifyPassword,
  createAdminSession,
  setAdminAuthCookies,
} from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const rl = await checkRateLimit(request, {
      scope: "admin_login",
      limit: 5,
      window: "15 m",
    });

    if (!rl.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Terlalu banyak percobaan login. Silakan tunggu 15 menit.",
        },
        { status: 429, headers: rl.headers }
      );
    }

    const body = await request.json().catch(() => ({}));
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "Username dan password wajib diisi." },
        { status: 400, headers: rl.headers }
      );
    }

    const db = getDb();
    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);

    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { ok: false, error: "Username atau password salah." },
        { status: 401, headers: rl.headers }
      );
    }

    const sessionData = await createAdminSession(user.id, request);
    const response = NextResponse.json(
      {
        ok: true,
        user: { id: user.id, username: user.username, role: user.role },
        csrfToken: sessionData.csrfToken,
      },
      { status: 200, headers: rl.headers }
    );

    await setAdminAuthCookies(response, sessionData);
    return response;
  } catch (err) {
    console.error("[admin/auth/login] Error:", err.message);
    return NextResponse.json(
      { ok: false, error: "Kesalahan server saat memproses login." },
      { status: 500 }
    );
  }
}

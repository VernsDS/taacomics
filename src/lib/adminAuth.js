/**
 * Admin Authentication & Session Management (PostgreSQL + Drizzle).
 * - Password hashing: scrypt with random 16-byte salt & constant-time comparison
 * - Session storage: PostgreSQL `admin_sessions` (revocable immediately)
 * - Cookie security: __Host-taacomics_session (in prod), HttpOnly, Secure, SameSite=Strict
 * - CSRF protection: HMAC-SHA256 token bound to session csrfSecret + Origin/Referer verification
 * - Zero hardcoded credentials or secret fallbacks
 */
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { eq, and, isNull, gt } from "drizzle-orm";
import { getDb } from "@/db/index";
import { adminUsers, adminSessions } from "@/db/schema";
import { getClientIp, PRIMARY_DOMAIN, ADMIN_DOMAIN } from "@/lib/security";

const IS_PROD = process.env.NODE_ENV === "production";
export const SESSION_COOKIE_NAME = IS_PROD ? "__Host-taacomics_session" : "taacomics_session";
export const CSRF_COOKIE_NAME = IS_PROD ? "__Host-taacomics_csrf" : "taacomics_csrf";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "FATAL [adminAuth]: ADMIN_SESSION_SECRET environment variable must be set and at least 32 characters long. Refusing to start with insecure/default secret."
    );
  }
  return secret;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .scryptSync(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
    .toString("hex");
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived}`;
}

export function verifyPassword(password, storedHash) {
  try {
    const parts = String(storedHash || "").split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = parts[4];
    const expectedHex = parts[5];

    const actualBuf = crypto.scryptSync(password, salt, KEYLEN, { N, r, p });
    const expectedBuf = Buffer.from(expectedHex, "hex");
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

function hashSessionToken(rawToken) {
  const pepper = getSessionSecret();
  return crypto.createHmac("sha256", pepper).update(String(rawToken)).digest("hex");
}

export function computeCsrfToken(sessionId, csrfSecret) {
  const pepper = getSessionSecret();
  return crypto
    .createHmac("sha256", `${pepper}:${csrfSecret}`)
    .update(String(sessionId))
    .digest("hex");
}

export async function createAdminSession(userId, request) {
  const db = getDb();
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(rawToken);
  const csrfSecret = crypto.randomBytes(24).toString("hex");
  const sessionId = `ses_${crypto.randomBytes(12).toString("hex")}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(adminSessions).values({
    id: sessionId,
    userId,
    tokenHash,
    csrfSecret,
    ipAddress: getClientIp(request),
    userAgent: (request?.headers?.get("user-agent") || "").slice(0, 255),
    expiresAt,
  });

  const csrfToken = computeCsrfToken(sessionId, csrfSecret);
  return { rawToken, sessionId, csrfToken, expiresAt };
}

export async function setAdminAuthCookies(response, { rawToken, csrfToken, expiresAt }) {
  const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

  response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/",
    maxAge,
  });

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Readable by admin client JS to attach as X-CSRF-Token header
    secure: IS_PROD,
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}

export function clearAdminAuthCookies(response) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(CSRF_COOKIE_NAME, "", {
    httpOnly: false,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function getActiveAdminSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashSessionToken(rawToken);
  const db = getDb();
  const now = new Date();

  const rows = await db
    .select({
      session: adminSessions,
      user: adminUsers,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.tokenHash, tokenHash),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.expiresAt, now),
        eq(adminUsers.isActive, true)
      )
    )
    .limit(1);

  if (!rows.length) return null;
  const { session, user } = rows[0];
  const csrfToken = computeCsrfToken(session.id, session.csrfSecret);

  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    csrfToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
}

export async function revokeAdminSessionByCookie() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return false;

  const tokenHash = hashSessionToken(rawToken);
  const db = getDb();
  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.tokenHash, tokenHash));
  return true;
}

/**
 * Verify session + CSRF token + Origin header for mutating admin API requests.
 */
export async function requireAdminMutationAuth(request) {
  const active = await getActiveAdminSession();
  if (!active) {
    return { ok: false, status: 401, error: "Sesi tidak valid atau sudah berakhir. Silakan login kembali." };
  }

  // Verify Origin / Referer header
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).hostname.toLowerCase();
      const validHost =
        originHost === ADMIN_DOMAIN ||
        originHost === PRIMARY_DOMAIN ||
        (!IS_PROD && (originHost === "localhost" || originHost === "admin.localhost"));
      if (!validHost) {
        return { ok: false, status: 403, error: "Origin request tidak diizinkan (CSRF Blocked)." };
      }
    } catch {
      return { ok: false, status: 403, error: "Header Origin tidak valid." };
    }
  }

  // Constant-time CSRF token comparison
  const headerCsrf = request.headers.get("x-csrf-token") || "";
  const expectedBuf = Buffer.from(active.csrfToken, "utf8");
  const actualBuf = Buffer.from(String(headerCsrf), "utf8");

  if (
    expectedBuf.length !== actualBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, actualBuf)
  ) {
    return { ok: false, status: 403, error: "Token CSRF tidak valid atau hilang." };
  }

  return { ok: true, session: active };
}

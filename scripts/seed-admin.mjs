#!/usr/bin/env node
/**
 * Seed initial admin user into PostgreSQL (Neon) via Drizzle.
 * Reads ADMIN_INITIAL_USERNAME and ADMIN_INITIAL_PASSWORD from environment.
 * Zero hardcoded fallbacks — exits with non-zero status if env vars are missing.
 */
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db/index.js";
import { adminUsers } from "../src/db/schema.js";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .scryptSync(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
    .toString("hex");
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived}`;
}

async function main() {
  const username = process.env.ADMIN_INITIAL_USERNAME?.trim();
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (!username || !password) {
    console.error(
      "FATAL [seed-admin]: ADMIN_INITIAL_USERNAME and ADMIN_INITIAL_PASSWORD environment variables must be set."
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("FATAL [seed-admin]: ADMIN_INITIAL_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }

  const db = getDb();
  const passwordHash = hashPassword(password);

  const existing = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.username, username))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(adminUsers)
      .set({ passwordHash, isActive: true, updatedAt: new Date() })
      .where(eq(adminUsers.username, username));
    console.log(`[seed-admin] Updated password hash for existing admin user: ${username}`);
  } else {
    await db.insert(adminUsers).values({
      username,
      passwordHash,
      role: "superadmin",
      isActive: true,
    });
    console.log(`[seed-admin] Created initial superadmin user: ${username}`);
  }
}

main().catch((err) => {
  console.error("[seed-admin] Failed:", err);
  process.exit(1);
});

/**
 * Site Maintenance Status store backed by PostgreSQL (Neon) + Drizzle.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { siteSettings } from "@/db/schema";

export const DEFAULT_MESSAGE = "MAAF SERVER SEDANG DALAM MASA PEMELIHARAAN";

export async function readMaintenance() {
  if (process.env.MAINTENANCE === "1" || process.env.MAINTENANCE === "true") {
    return {
      enabled: true,
      message: process.env.MAINTENANCE_MESSAGE || DEFAULT_MESSAGE,
    };
  }

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, "maintenance"))
      .limit(1);

    if (rows.length > 0 && rows[0].value && typeof rows[0].value === "object") {
      const val = rows[0].value;
      return {
        enabled: Boolean(val.enabled),
        message: String(val.message || DEFAULT_MESSAGE),
      };
    }
  } catch (err) {
    console.error("[siteStatus] DB read error:", err.message);
  }

  return { enabled: false, message: DEFAULT_MESSAGE };
}

export async function writeMaintenance(enabled, message) {
  const cleanValue = {
    enabled: Boolean(enabled),
    message: String(message || DEFAULT_MESSAGE).trim().slice(0, 500) || DEFAULT_MESSAGE,
  };

  const db = getDb();
  await db
    .insert(siteSettings)
    .values({
      key: "maintenance",
      value: cleanValue,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value: cleanValue,
        updatedAt: new Date(),
      },
    });

  return { ok: true, ...cleanValue };
}

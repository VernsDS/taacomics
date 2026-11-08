import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

/**
 * Strict fail-fast database client initialization.
 * Never falls back to hardcoded credentials.
 */
function createDbClient() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "FATAL [TaaComics DB]: Environment variable DATABASE_URL is missing or empty. Application cannot start without a valid Neon PostgreSQL connection string."
    );
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

let _db = null;

export function getDb() {
  if (!_db) {
    _db = createDbClient();
  }
  return _db;
}

export { schema };

-- TaaComics PostgreSQL (Neon) Initial Migration
-- Generated for Drizzle ORM schema (src/db/schema.js)

CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" serial PRIMARY KEY NOT NULL,
  "username" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" text DEFAULT 'superadmin' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_username_idx" ON "admin_users" ("username");

CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "csrf_secret" text NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_sessions_token_hash_idx" ON "admin_sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "admin_sessions_user_id_idx" ON "admin_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "admin_sessions_expires_at_idx" ON "admin_sessions" ("expires_at");

CREATE TABLE IF NOT EXISTS "announcements" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "level" text DEFAULT 'info' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "announcements_active_created_idx" ON "announcements" ("active", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "site_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "blocklist" (
  "id" serial PRIMARY KEY NOT NULL,
  "keyword" text NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "blocklist_keyword_idx" ON "blocklist" ("keyword");

CREATE TABLE IF NOT EXISTS "custom_manga" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "alt_title" text,
  "cover_url" text,
  "synopsis" text,
  "type" text DEFAULT 'Custom' NOT NULL,
  "status" text DEFAULT 'Ongoing' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "custom_manga_slug_idx" ON "custom_manga" ("slug");

CREATE TABLE IF NOT EXISTS "custom_chapters" (
  "id" text PRIMARY KEY NOT NULL,
  "manga_id" integer NOT NULL REFERENCES "custom_manga"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "label" text NOT NULL,
  "number" double precision DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "custom_chapters_manga_id_idx" ON "custom_chapters" ("manga_id");
CREATE INDEX IF NOT EXISTS "custom_chapters_slug_number_idx" ON "custom_chapters" ("slug", "number");

CREATE TABLE IF NOT EXISTS "custom_chapter_pages" (
  "id" serial PRIMARY KEY NOT NULL,
  "chapter_id" text NOT NULL REFERENCES "custom_chapters"("id") ON DELETE CASCADE,
  "page_number" integer NOT NULL,
  "image_url" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "custom_chapter_pages_chapter_page_idx" ON "custom_chapter_pages" ("chapter_id", "page_number");
CREATE INDEX IF NOT EXISTS "custom_chapter_pages_chapter_id_idx" ON "custom_chapter_pages" ("chapter_id");

-- Jalankan hanya jika tabel blocklist belum ada.
CREATE TABLE IF NOT EXISTS "blocklist" (
  "id" serial PRIMARY KEY NOT NULL,
  "keyword" text NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "blocklist_keyword_idx"
  ON "blocklist" ("keyword");

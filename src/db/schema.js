import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* 1. Admin Users */
export const adminUsers = pgTable(
  "admin_users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("superadmin"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("admin_users_username_idx").on(t.username)]
);

/* 2. Admin Sessions (revocable server-side sessions) */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    csrfSecret: text("csrf_secret").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("admin_sessions_token_hash_idx").on(t.tokenHash),
    index("admin_sessions_user_id_idx").on(t.userId),
    index("admin_sessions_expires_at_idx").on(t.expiresAt),
  ]
);

/* 3. Announcements */
export const announcements = pgTable(
  "announcements",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    level: text("level").notNull().default("info"), // 'info' | 'warning' | 'success'
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("announcements_active_created_idx").on(t.active, t.createdAt)]
);

/* 4. Site Settings (maintenance mode, global config) */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* 5. Blocklist (hidden manga keywords/titles) */
export const blocklist = pgTable(
  "blocklist",
  {
    id: serial("id").primaryKey(),
    keyword: text("keyword").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("blocklist_keyword_idx").on(t.keyword)]
);

/* 6. Custom Manga (parent metadata for custom chapters) */
export const customManga = pgTable(
  "custom_manga",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    altTitle: text("alt_title"),
    coverUrl: text("cover_url"),
    synopsis: text("synopsis"),
    type: text("type").notNull().default("Custom"),
    status: text("status").notNull().default("Ongoing"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("custom_manga_slug_idx").on(t.slug)]
);

/* 7. Custom Chapters */
export const customChapters = pgTable(
  "custom_chapters",
  {
    id: text("id").primaryKey(),
    mangaId: integer("manga_id")
      .notNull()
      .references(() => customManga.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    number: doublePrecision("number").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("custom_chapters_manga_id_idx").on(t.mangaId),
    index("custom_chapters_slug_number_idx").on(t.slug, t.number),
  ]
);

/* 8. Custom Chapter Pages */
export const customChapterPages = pgTable(
  "custom_chapter_pages",
  {
    id: serial("id").primaryKey(),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => customChapters.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    imageUrl: text("image_url").notNull(),
  },
  (t) => [
    uniqueIndex("custom_chapter_pages_chapter_page_idx").on(t.chapterId, t.pageNumber),
    index("custom_chapter_pages_chapter_id_idx").on(t.chapterId),
  ]
);

/* Relations */
export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(adminSessions),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  user: one(adminUsers, {
    fields: [adminSessions.userId],
    references: [adminUsers.id],
  }),
}));

export const customMangaRelations = relations(customManga, ({ many }) => ({
  chapters: many(customChapters),
}));

export const customChaptersRelations = relations(customChapters, ({ one, many }) => ({
  manga: one(customManga, {
    fields: [customChapters.mangaId],
    references: [customManga.id],
  }),
  pages: many(customChapterPages),
}));

export const customChapterPagesRelations = relations(customChapterPages, ({ one }) => ({
  chapter: one(customChapters, {
    fields: [customChapterPages.chapterId],
    references: [customChapters.id],
  }),
}));

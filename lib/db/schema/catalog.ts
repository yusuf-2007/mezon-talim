import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import {
  courseStatus,
  createdAt,
  deletedAt,
  type LocalizedText,
  updatedAt,
} from "./_shared";

/**
 * Catalog & content: courses → modules → video lessons. Bunny stores the video
 * (view-only, no downloads); everything else stays in-country.
 */
export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: jsonb("title").$type<LocalizedText>().notNull(),
  summary: jsonb("summary").$type<LocalizedText>(), // short, for cards
  description: jsonb("description").$type<LocalizedText>(), // long, course page
  coverUrl: text("cover_url"),
  status: courseStatus("status").notNull().default("draft"),

  // Money is integer tiyin (UZS × 100). Never float. Pricing model is TBD #1 —
  // default is per-course purchase with ~1-year access; do not hardcode prices.
  priceTiyin: bigint("price_tiyin", { mode: "number" }).notNull().default(0),
  accessDurationDays: integer("access_duration_days").notNull().default(365),

  certificateEnabled: boolean("certificate_enabled").notNull().default(true),
  passThresholdPct: integer("pass_threshold_pct").notNull().default(70),

  createdBy: uuid("created_by").references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

export const modules = pgTable("modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  title: jsonb("title").$type<LocalizedText>().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const lessons = pgTable("lessons", {
  id: uuid("id").defaultRandom().primaryKey(),
  moduleId: uuid("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  title: jsonb("title").$type<LocalizedText>().notNull(),
  body: jsonb("body").$type<LocalizedText>(), // rich text shown under the video
  bunnyVideoId: text("bunny_video_id"), // Bunny Stream GUID
  durationSeconds: integer("duration_seconds"),
  isPreview: boolean("is_preview").notNull().default(false), // free preview (B1)
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

/** Per-locale subtitle tracks for a lesson (B5). */
export const lessonSubtitles = pgTable("lesson_subtitles", {
  id: uuid("id").defaultRandom().primaryKey(),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  locale: text("locale").notNull(), // 'uz' | 'ru'
  url: text("url"), // VTT in storage, or inline below
  content: text("content"),
  createdAt: createdAt(),
});

/** Glossary / izohli lug'at (B9). Null course_id = global term. */
export const glossaryTerms = pgTable("glossary_terms", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id").references(() => courses.id, {
    onDelete: "cascade",
  }),
  term: text("term").notNull(),
  definition: jsonb("definition").$type<LocalizedText>().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
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
  category: text("category"), // course taxonomy / subject (admin-set, optional)
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
  // DEPRECATED — superseded by lesson_videos (parts); nothing reads or writes
  // it. Kept one release so the previous deploy keeps working while the
  // additive migrations run; drop it in a follow-up migration.
  bunnyVideoId: text("bunny_video_id"),
  // Total of the lesson's video parts (lesson_videos), kept in sync on save.
  durationSeconds: integer("duration_seconds"),
  isPreview: boolean("is_preview").notNull().default(false), // free preview (B1)
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

/** What a lesson attachment was uploaded as. Each PDF page / image = one slide. */
export const attachmentKind = pgEnum("attachment_kind", ["pdf", "image"]);

/**
 * Upload lifecycle. The row is written before the browser uploads straight to
 * the bucket (`uploading`); finalize verifies every object exists and flips it
 * to `ready`, or `failed` when something is missing or not an image.
 */
export const attachmentStatus = pgEnum("attachment_status", [
  "uploading",
  "ready",
  "failed",
]);

/** Pixel size of one rendered slide (for layout before the bytes arrive). */
export type AttachmentPageSize = { w: number; h: number };

/**
 * Lesson materials shown as slides under the video. Files live in the
 * in-country MinIO bucket under `storage_prefix`:
 *   {storage_prefix}/original    — the uploaded file (private)
 *   {storage_prefix}/p/{n}.webp  — slide n (1-based), rendered in the browser
 *                                  (`.jpg` when slide_mime is image/jpeg)
 * The original reaches a student only when `allow_download` is on; otherwise
 * slides are served through the app with a per-viewer watermark. Hard delete
 * (row + objects).
 */
export const lessonAttachments = pgTable(
  "lesson_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    title: jsonb("title").$type<LocalizedText>().notNull(),
    kind: attachmentKind("kind").notNull(),
    status: attachmentStatus("status").notNull().default("uploading"),
    fileName: text("file_name").notNull(), // original name, for the download
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    pageCount: integer("page_count").notNull(),
    pages: jsonb("pages").$type<AttachmentPageSize[]>().notNull(),
    // Format of the rendered slides. WebP everywhere it can be encoded; JPEG is
    // the fallback for browsers whose canvas cannot encode WebP (Safari).
    slideMime: text("slide_mime").$type<"image/webp" | "image/jpeg">().notNull().default("image/webp"),
    storagePrefix: text("storage_prefix").notNull(), // lesson-attachments/{lessonId}/{id}
    allowDownload: boolean("allow_download").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("lesson_attachments_lesson_idx").on(t.lessonId, t.orderIndex)],
);

/**
 * The video parts of a lesson, in play order. A long lesson (2–3 hours) is
 * split into parts — Part 1, Part 2 … — that stay ONE lesson for progress,
 * sequential unlock and exams. `lessons.duration_seconds` holds the total.
 */
export const lessonVideos = pgTable(
  "lesson_videos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    // Optional: without one the part shows as "1-qism", "2-qism"…
    title: jsonb("title").$type<LocalizedText>(),
    bunnyVideoId: text("bunny_video_id").notNull(), // Bunny Stream GUID
    durationSeconds: integer("duration_seconds"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("lesson_videos_lesson_idx").on(t.lessonId, t.orderIndex)],
);

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

import {
  boolean,
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses, lessons } from "./catalog";
import { payments } from "./payment";
import {
  createdAt,
  enrollmentStatus,
  timestamptz,
  updatedAt,
} from "./_shared";

/**
 * Enrollment & progress. An enrollment is created/activated ONLY on a verified
 * `paid` payment callback (see payments). `expires_at` = started_at +
 * course.access_duration_days (pricing model is TBD #1 — keep flexible).
 */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    status: enrollmentStatus("status").notNull().default("active"),
    sourcePaymentId: uuid("source_payment_id").references(() => payments.id),
    startedAt: timestamptz("started_at").defaultNow().notNull(),
    expiresAt: timestamptz("expires_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("enrollments_user_course_uq").on(t.userId, t.courseId)],
);

/** Drives sequential unlock (B2), resume (B3), and self-assessment (B11). */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completed: boolean("completed").notNull().default(false),
    lastPositionSeconds: integer("last_position_seconds").notNull().default(0),
    selfAssessment: integer("self_assessment"), // 1–5, "how well I understood"
    updatedAt: updatedAt(),
  },
  (t) => [unique("lesson_progress_user_lesson_uq").on(t.userId, t.lessonId)],
);

/** Student bookmarks within a lesson (B8). */
export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  label: text("label"),
  timestampSeconds: integer("timestamp_seconds"),
  createdAt: createdAt(),
});

/** Private student notes per lesson (B7). */
export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

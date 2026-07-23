import { index, pgTable, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { lessons } from "./catalog";
import { createdAt, updatedAt } from "./_shared";

/**
 * Per-lesson discussion — YouTube-style comments (B19). Threads are one level
 * deep: a comment either is top-level (`parentId` null) or replies to a
 * top-level comment; replying to a reply flattens into the same thread (the
 * action enforces this). Deleting a comment hard-deletes its replies (cascade),
 * matching YouTube semantics. Visible to everyone who can open the lesson;
 * moderated by teachers/super admins.
 */
export const lessonComments = pgTable(
  "lesson_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => lessonComments.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("lesson_comments_lesson_idx").on(t.lessonId, t.createdAt)],
);

/**
 * Private student→instructor messages, per lesson. A thread is identified by
 * (lessonId, studentId): the student who asked, regardless of who sent each
 * message (`senderId` distinguishes the two sides). Visible ONLY to that
 * student, the course's owning teacher (`courses.createdBy`), and super
 * admins — enforced in the app layer (actions + page fetch), like all authz.
 */
export const lessonMessages = pgTable(
  "lesson_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("lesson_messages_thread_idx").on(t.lessonId, t.studentId, t.createdAt),
  ],
);

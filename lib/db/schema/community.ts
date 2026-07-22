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

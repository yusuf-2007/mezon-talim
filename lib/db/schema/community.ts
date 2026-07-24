import { index, pgTable, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses, lessons } from "./catalog";
import { createdAt, timestamptz, updatedAt } from "./_shared";

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

/**
 * In-app notifications (the header bell). One row per recipient per event.
 * `type` drives the rendered text: 'private_question' (student → course
 * author), 'private_reply' (instructor → student), 'comment_reply' (reply in
 * a thread you participate in), 'lesson_comment' (new top-level comment →
 * course author). Distinct from the `notifications` table, which audits
 * outbound email/SMS sends. Created best-effort from community actions — a
 * failed insert must never break the comment/message itself. The source FKs
 * cascade so that deleting (moderating away) a comment or message also
 * removes any notification still quoting its excerpt.
 */
export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Recipient. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Who triggered it (kept nullable so account deletion preserves history). */
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    /** The comment/message that caused this — cascade on moderation delete. */
    sourceCommentId: uuid("source_comment_id").references(() => lessonComments.id, {
      onDelete: "cascade",
    }),
    sourceMessageId: uuid("source_message_id").references(() => lessonMessages.id, {
      onDelete: "cascade",
    }),
    /** Short preview of the message/comment body. */
    excerpt: text("excerpt"),
    readAt: timestamptz("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("user_notifications_user_idx").on(t.userId, t.createdAt)],
);

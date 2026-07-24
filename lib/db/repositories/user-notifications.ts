import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../client";
import { lessons, userNotifications, users } from "../schema";
import type { LocalizedText } from "../schema";

export type UserNotificationType =
  | "private_question"
  | "private_reply"
  | "comment_reply"
  | "lesson_comment";

export type UserNotificationItem = {
  id: string;
  type: string;
  actorName: string | null;
  courseId: string;
  lessonId: string;
  lessonTitle: LocalizedText | null;
  excerpt: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * In-app notifications for the header bell. Writes happen best-effort from the
 * community actions; reads/mutations are always scoped to the recipient —
 * there is no cross-user access path by construction.
 */
export const userNotificationsRepository = {
  async create(input: {
    userId: string;
    actorUserId: string;
    type: UserNotificationType;
    courseId: string;
    lessonId: string;
    excerpt: string | null;
    sourceCommentId?: string | null;
    sourceMessageId?: string | null;
  }) {
    const [row] = await db.insert(userNotifications).values(input).returning();
    return row;
  },

  /** Latest notifications, newest-first (bell dropdown + /notifications page). */
  async listForUser(
    userId: string,
    limit = 15,
    offset = 0,
  ): Promise<UserNotificationItem[]> {
    return db
      .select({
        id: userNotifications.id,
        type: userNotifications.type,
        actorName: users.fullName,
        courseId: userNotifications.courseId,
        lessonId: userNotifications.lessonId,
        lessonTitle: lessons.title,
        excerpt: userNotifications.excerpt,
        readAt: userNotifications.readAt,
        createdAt: userNotifications.createdAt,
      })
      .from(userNotifications)
      .leftJoin(users, eq(users.id, userNotifications.actorUserId))
      .leftJoin(lessons, eq(lessons.id, userNotifications.lessonId))
      .where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt), desc(userNotifications.id))
      .limit(limit)
      .offset(offset);
  },

  async unreadCount(userId: string): Promise<number> {
    const [row] = await db
      .select({ n: count() })
      .from(userNotifications)
      .where(
        and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt)),
      );
    return row?.n ?? 0;
  },

  /** Scoped to the owner so one user can never mark another's as read. */
  async markRead(id: string, userId: string) {
    await db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(userNotifications.id, id), eq(userNotifications.userId, userId)),
      );
  },

  async markAllRead(userId: string) {
    await db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt)),
      );
  },
};

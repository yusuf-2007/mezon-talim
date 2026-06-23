import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import { bookmarks } from "../schema";

/** Student bookmarks within a lesson (B8). Scoped to the owning user. */
export const bookmarksRepository = {
  async listForLesson(userId: string, lessonId: string) {
    return db
      .select()
      .from(bookmarks)
      .where(
        and(eq(bookmarks.userId, userId), eq(bookmarks.lessonId, lessonId)),
      )
      .orderBy(asc(bookmarks.timestampSeconds), asc(bookmarks.createdAt));
  },

  async create(
    userId: string,
    lessonId: string,
    label: string | null,
    timestampSeconds: number | null,
  ) {
    const [row] = await db
      .insert(bookmarks)
      .values({ userId, lessonId, label, timestampSeconds })
      .returning();
    return row;
  },

  async remove(userId: string, bookmarkId: string) {
    await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)));
  },
};

import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { notes } from "../schema";

/**
 * Private per-lesson student notes (B7 + B8 merged). A note may carry an
 * optional video timestamp — the old bookmarks feature folded in. Always
 * scoped to the owning user.
 */
export const notesRepository = {
  async listForLesson(userId: string, lessonId: string) {
    return db
      .select()
      .from(notes)
      .where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)))
      .orderBy(asc(notes.createdAt));
  },

  async create(
    userId: string,
    lessonId: string,
    body: string,
    timestampSeconds: number | null = null,
  ) {
    const [row] = await db
      .insert(notes)
      .values({ userId, lessonId, body, timestampSeconds })
      .returning();
    return row;
  },

  /** Update only if the note belongs to the user. */
  async update(userId: string, noteId: string, body: string) {
    await db
      .update(notes)
      .set({ body, updatedAt: sql`now()` })
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
  },

  async remove(userId: string, noteId: string) {
    await db
      .delete(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
  },
};

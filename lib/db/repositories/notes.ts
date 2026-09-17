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

  /**
   * How many notes the student has, and how many pin a video timestamp.
   * The dashboard shows these as two separate counts because that is how the
   * product speaks of them — notes and bookmarks — even though migration 0008
   * folded bookmarks into notes as "a note at a moment".
   */
  async countsForUser(userId: string) {
    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        pinned: sql<number>`count(*) filter (where ${notes.timestampSeconds} is not null)`,
      })
      .from(notes)
      .where(eq(notes.userId, userId));
    return { total: Number(row?.total ?? 0), pinned: Number(row?.pinned ?? 0) };
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

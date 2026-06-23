import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import { lessonProgress } from "../schema";

/**
 * Lesson progress repository — drives sequential unlock (B2), resume (B3), and
 * the 1–5 self-assessment (B11). One row per (user, lesson).
 */
export const lessonProgressRepository = {
  async forLesson(userId: string, lessonId: string) {
    const [row] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.lessonId, lessonId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /** Progress rows for a set of lessons (the whole course curriculum). */
  async forLessons(userId: string, lessonIds: string[]) {
    if (lessonIds.length === 0) return [];
    return db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          inArray(lessonProgress.lessonId, lessonIds),
        ),
      );
  },

  /** Mark a lesson complete (idempotent), optionally recording self-assessment. */
  async markComplete(
    userId: string,
    lessonId: string,
    selfAssessment?: number | null,
  ) {
    const [row] = await db
      .insert(lessonProgress)
      .values({
        userId,
        lessonId,
        completed: true,
        selfAssessment: selfAssessment ?? null,
      })
      .onConflictDoUpdate({
        target: [lessonProgress.userId, lessonProgress.lessonId],
        set: {
          completed: true,
          ...(selfAssessment != null ? { selfAssessment } : {}),
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return row;
  },

  /** Persist the last playback position for resume. */
  async savePosition(userId: string, lessonId: string, seconds: number) {
    await db
      .insert(lessonProgress)
      .values({ userId, lessonId, lastPositionSeconds: seconds })
      .onConflictDoUpdate({
        target: [lessonProgress.userId, lessonProgress.lessonId],
        set: { lastPositionSeconds: seconds, updatedAt: sql`now()` },
      });
  },
};

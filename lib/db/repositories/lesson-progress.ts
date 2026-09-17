import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import { lessonProgress } from "../schema";
import { APP_TIME_ZONE } from "@/lib/utils";

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

  /** Reset (delete) a user's progress for a set of lessons (admin action). */
  async resetForLessons(userId: string, lessonIds: string[]) {
    if (lessonIds.length === 0) return;
    await db
      .delete(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          inArray(lessonProgress.lessonId, lessonIds),
        ),
      );
  },

  /** Completed-lesson count per user across a set of lessons (course roster). */
  async completedCountsForLessons(lessonIds: string[]) {
    if (lessonIds.length === 0)
      return [] as { userId: string; completed: number }[];
    const rows = await db
      .select({
        userId: lessonProgress.userId,
        completed: sql<number>`count(*) filter (where ${lessonProgress.completed})`,
      })
      .from(lessonProgress)
      .where(inArray(lessonProgress.lessonId, lessonIds))
      .groupBy(lessonProgress.userId);
    return rows.map((r) => ({ userId: r.userId, completed: Number(r.completed) }));
  },

  /** Persist the last playback position for resume. */
  /**
   * Lessons completed per day over the last `days` days, oldest first.
   *
   * Deliberately counts lessons, not minutes. `savePosition` exists but is
   * called by nothing, so no watch-time has ever been recorded and any
   * duration shown here would be invented. A completion carries a real
   * timestamp, so this is the strongest honest signal available — swap it for
   * true watch-time once the player actually reports position.
   */
  async completionsByDay(userId: string, days = 7) {
    const rows = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${lessonProgress.updatedAt} at time zone ${APP_TIME_ZONE}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)`,
      })
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.completed, true),
          gte(
            lessonProgress.updatedAt,
            sql`(date_trunc('day', now() at time zone ${APP_TIME_ZONE}) - make_interval(days => ${days - 1})) at time zone ${APP_TIME_ZONE}`,
          ),
        ),
      )
      // `group by 1` (the select's first column), not a repeat of the
      // expression: the timezone is a bind parameter, and Postgres will not
      // treat $1 and $7 as the same thing when it matches grouping terms.
      .groupBy(sql`1`);
    return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
  },

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

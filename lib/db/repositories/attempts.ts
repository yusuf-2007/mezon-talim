import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { attemptAnswers, attempts } from "../schema";

/** Exam attempts + saved answers. Enforcement (limits/cooldown/window) lives in
 * the attempt service; this is pure persistence. */
export const attemptsRepository = {
  async findById(id: string) {
    const [row] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, id))
      .limit(1);
    return row ?? null;
  },

  async listForUser(userId: string, assessmentId: string) {
    return db
      .select()
      .from(attempts)
      .where(
        and(eq(attempts.userId, userId), eq(attempts.assessmentId, assessmentId)),
      )
      .orderBy(desc(attempts.attemptNo));
  },

  async findInProgress(userId: string, assessmentId: string) {
    const [row] = await db
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.userId, userId),
          eq(attempts.assessmentId, assessmentId),
          isNull(attempts.submittedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async start(userId: string, assessmentId: string) {
    const [{ next }] = await db
      .select({
        next: sql<number>`coalesce(max(${attempts.attemptNo}) + 1, 1)`,
      })
      .from(attempts)
      .where(
        and(eq(attempts.userId, userId), eq(attempts.assessmentId, assessmentId)),
      );
    const [row] = await db
      .insert(attempts)
      .values({ userId, assessmentId, attemptNo: next })
      .returning();
    return row;
  },

  async submit(attemptId: string, scorePct: number, passed: boolean) {
    const [row] = await db
      .update(attempts)
      .set({ submittedAt: sql`now()`, scorePct, passed })
      .where(eq(attempts.id, attemptId))
      .returning();
    return row;
  },

  // ── answers ────────────────────────────────────────────────────────────────

  async listAnswers(attemptId: string) {
    return db
      .select()
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attemptId));
  },

  async upsertAnswer(
    attemptId: string,
    questionId: string,
    selectedOptionIds: string[],
  ) {
    await db
      .insert(attemptAnswers)
      .values({ attemptId, questionId, selectedOptionIds })
      .onConflictDoUpdate({
        target: [attemptAnswers.attemptId, attemptAnswers.questionId],
        set: { selectedOptionIds },
      });
  },

  async setAnswerCorrectness(
    attemptId: string,
    questionId: string,
    isCorrect: boolean,
  ) {
    await db
      .update(attemptAnswers)
      .set({ isCorrect })
      .where(
        and(
          eq(attemptAnswers.attemptId, attemptId),
          eq(attemptAnswers.questionId, questionId),
        ),
      );
  },
};

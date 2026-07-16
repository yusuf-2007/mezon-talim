import "server-only";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { assessments, attemptAnswers, attempts } from "../schema";

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

  /** Every submitted attempt for a user, joined with its assessment (admin view). */
  async listForUserAll(userId: string) {
    return db
      .select({
        attempt: attempts,
        assessment: {
          id: assessments.id,
          type: assessments.type,
          title: assessments.title,
          courseId: assessments.courseId,
          isScored: assessments.isScored,
          passThresholdPct: assessments.passThresholdPct,
          maxAttempts: assessments.maxAttempts,
        },
      })
      .from(attempts)
      .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
      .where(eq(attempts.userId, userId))
      .orderBy(desc(attempts.startedAt));
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
    try {
      const [row] = await db
        .insert(attempts)
        .values({ userId, assessmentId, attemptNo: next })
        .returning();
      return row;
    } catch (err) {
      // A concurrent start hit attempts_one_in_progress_uq — return the live one.
      const existing = await this.findInProgress(userId, assessmentId);
      if (existing) return existing;
      throw err;
    }
  },

  /**
   * Void the latest non-voided submitted attempt for (user, assessment) — the
   * "grant retry" admin action. Returns false if there was none to void.
   */
  async voidLatestAttempt(userId: string, assessmentId: string) {
    const [latest] = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(
        and(
          eq(attempts.userId, userId),
          eq(attempts.assessmentId, assessmentId),
          isNotNull(attempts.submittedAt),
          eq(attempts.voided, false),
        ),
      )
      .orderBy(desc(attempts.attemptNo))
      .limit(1);
    if (!latest) return false;
    await db
      .update(attempts)
      .set({ voided: true })
      .where(eq(attempts.id, latest.id));
    return true;
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

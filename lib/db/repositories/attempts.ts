import "server-only";
import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { assessments, attemptAnswers, attempts, courses, questions, users } from "../schema";

/** Exam attempts + saved answers. Enforcement (limits/cooldown/window) lives in
 * the attempt service; this is pure persistence. */
export const attemptsRepository = {
  /**
   * Headline exam numbers over the last `days`.
   *
   * First-try pass rate is tracked separately from the overall one: a course
   * where everyone passes eventually but almost nobody passes first time is
   * teaching badly, and a single pass rate hides that completely.
   */
  async examStats(days = 30) {
    const [row] = await db
      .select({
        attempts: sql<number>`count(*)`,
        passed: sql<number>`count(*) filter (where ${attempts.passed})`,
        firstTry: sql<number>`count(*) filter (where ${attempts.passed} and ${attempts.attemptNo} = 1)`,
        avgScore: sql<number>`coalesce(round(avg(${attempts.scorePct})), 0)`,
      })
      .from(attempts)
      .where(
        and(
          isNotNull(attempts.submittedAt),
          eq(attempts.voided, false),
          gte(attempts.submittedAt, sql`now() - make_interval(days => ${days})`),
        ),
      );
    return {
      attempts: Number(row?.attempts ?? 0),
      passed: Number(row?.passed ?? 0),
      firstTry: Number(row?.firstTry ?? 0),
      avgScore: Number(row?.avgScore ?? 0),
    };
  },

  /** Pass/fail split per published assessment, for the exam list. */
  async byAssessment(type: "final_exam" | "module_test") {
    return db
      .select({
        assessmentId: assessments.id,
        title: assessments.title,
        courseId: assessments.courseId,
        courseTitle: courses.title,
        moduleId: assessments.moduleId,
        passThresholdPct: assessments.passThresholdPct,
        maxAttempts: assessments.maxAttempts,
        timeLimitSeconds: assessments.timeLimitSeconds,
        isPublished: assessments.isPublished,
        passed: sql<number>`count(${attempts.id}) filter (where ${attempts.passed})`,
        failed: sql<number>`count(${attempts.id}) filter (where ${attempts.passed} = false)`,
      })
      .from(assessments)
      .innerJoin(courses, eq(courses.id, assessments.courseId))
      .leftJoin(
        attempts,
        and(
          eq(attempts.assessmentId, assessments.id),
          eq(attempts.voided, false),
          isNotNull(attempts.submittedAt),
        ),
      )
      .where(eq(assessments.type, type))
      .groupBy(assessments.id, courses.title)
      .orderBy(courses.title, assessments.id);
  },

  /**
   * The questions people get wrong, worst first.
   *
   * Only questions with enough answers to mean anything — a single wrong
   * answer is not a signal, and ranking by it would put noise at the top.
   */
  async hardestQuestions(limit = 5, minAnswers = 3) {
    return db
      .select({
        questionId: questions.id,
        prompt: questions.prompt,
        assessmentId: questions.assessmentId,
        assessmentTitle: assessments.title,
        answers: sql<number>`count(${attemptAnswers.id})`,
        correctPct: sql<number>`round(100.0 * count(${attemptAnswers.id}) filter (where ${attemptAnswers.isCorrect}) / nullif(count(${attemptAnswers.id}), 0))`,
      })
      .from(attemptAnswers)
      .innerJoin(questions, eq(questions.id, attemptAnswers.questionId))
      .innerJoin(assessments, eq(assessments.id, questions.assessmentId))
      .groupBy(questions.id, questions.prompt, questions.assessmentId, assessments.title)
      .having(sql`count(${attemptAnswers.id}) >= ${minAnswers}`)
      .orderBy(
        sql`round(100.0 * count(${attemptAnswers.id}) filter (where ${attemptAnswers.isCorrect}) / nullif(count(${attemptAnswers.id}), 0)) asc`,
      )
      .limit(limit);
  },

  /** Most recently submitted attempts, with who and which exam. */
  async recentWithContext(limit = 10) {
    return db
      .select({
        id: attempts.id,
        userId: attempts.userId,
        userName: users.fullName,
        assessmentTitle: assessments.title,
        assessmentType: assessments.type,
        attemptNo: attempts.attemptNo,
        scorePct: attempts.scorePct,
        passed: attempts.passed,
        startedAt: attempts.startedAt,
        submittedAt: attempts.submittedAt,
      })
      .from(attempts)
      .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
      .innerJoin(users, eq(users.id, attempts.userId))
      .where(isNotNull(attempts.submittedAt))
      .orderBy(desc(attempts.submittedAt))
      .limit(limit);
  },

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

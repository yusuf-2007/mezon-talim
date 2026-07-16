import "server-only";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { questionsRepository } from "@/lib/db/repositories/questions";
import type { QuestionWithOptions } from "@/lib/db/repositories/questions";
import { attemptsRepository } from "@/lib/db/repositories/attempts";
import { auditRepository } from "@/lib/db/repositories/audit";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { modulesRepository } from "@/lib/db/repositories/modules";
import type { LocalizedText } from "@/lib/db/schema";
import { grade, orderQuestionsForAttempt } from "./grading";
import { getExamPrerequisites, type ExamPrerequisites } from "./gating";
import { issueIfEligible } from "@/lib/certificates/service";

type Assessment = NonNullable<
  Awaited<ReturnType<typeof assessmentsRepository.findById>>
>;

/** Question as exposed to the runner — correct flags stripped. */
export type RunnerQuestion = {
  id: string;
  type: "single" | "multiple" | "true_false";
  prompt: LocalizedText;
  points: number;
  options: { id: string; label: LocalizedText }[];
};

export type BlockReason =
  | "not_enrolled"
  | "already_passed"
  | "no_attempts_left"
  | "cooldown"
  | "unpublished"
  | "lessons_incomplete"
  | "module_tests_incomplete";

export type ExamOverview = {
  assessment: Assessment;
  questionCount: number;
  attemptsUsed: number;
  attemptsLeft: number | null; // null = unlimited
  alreadyPassed: boolean;
  bestScorePct: number | null;
  inProgress: boolean;
  canStart: boolean;
  blockedReason: BlockReason | null;
  cooldownUntil: number | null; // unix ms
  /** Final-exam prerequisite chain (null for non-final assessments). */
  prereq: ExamPrerequisites | null;
  /** Student has already sent a retry-access request since their last attempt. */
  retryRequested: boolean;
  /** Recent submitted attempts, newest first (for the history block). */
  history: { attemptNo: number; scorePct: number | null; passed: boolean; submittedAt: number }[];
};

function timeWindow(assessment: Assessment, startedAt: Date) {
  if (!assessment.timeLimitSeconds) return { expired: false, endsAt: null };
  const endsAt = startedAt.getTime() + assessment.timeLimitSeconds * 1000;
  return { expired: Date.now() >= endsAt, endsAt };
}

export async function getExamOverview(
  assessmentId: string,
  userId: string,
): Promise<ExamOverview | null> {
  const assessment = await assessmentsRepository.findById(assessmentId);
  if (!assessment) return null;

  const isFinal = assessment.type === "final_exam";
  const [questionCount, all, enrolled, prereq] = await Promise.all([
    questionsRepository.countByAssessment(assessmentId),
    attemptsRepository.listForUser(userId, assessmentId),
    enrollmentsRepository.isActive(userId, assessment.courseId),
    isFinal ? getExamPrerequisites(userId, assessment.courseId) : Promise.resolve(null),
  ]);

  // Voided attempts ("grant retry") don't count toward limits or cooldown.
  const submitted = all.filter((a) => a.submittedAt && !a.voided);
  const attemptsUsed = submitted.length;
  const alreadyPassed = submitted.some((a) => a.passed);
  const bestScorePct = submitted.reduce<number | null>(
    (best, a) => (a.scorePct != null && (best == null || a.scorePct > best) ? a.scorePct : best),
    null,
  );
  const inProgress = all.some((a) => !a.submittedAt);

  const attemptsLeft = assessment.maxAttempts
    ? Math.max(0, assessment.maxAttempts - attemptsUsed)
    : null;

  // Most recent submitted attempt (drives cooldown + retry-request dedup).
  const lastSubmitted =
    submitted.length > 0
      ? submitted.reduce((a, b) => (a.submittedAt! > b.submittedAt! ? a : b))
      : null;

  let cooldownUntil: number | null = null;
  if (assessment.attemptCooldownHours && lastSubmitted) {
    cooldownUntil =
      lastSubmitted.submittedAt!.getTime() +
      assessment.attemptCooldownHours * 3600_000;
  }

  // Has the student already asked for access since their last attempt?
  const retryRequested =
    attemptsLeft === 0 && !alreadyPassed && lastSubmitted
      ? await auditRepository.existsSince(
          userId,
          "attempt.retry_requested",
          assessmentId,
          lastSubmitted.submittedAt!,
        )
      : false;

  let blockedReason: BlockReason | null = null;
  if (!assessment.isPublished) blockedReason = "unpublished";
  else if (!enrolled) blockedReason = "not_enrolled";
  else if (!inProgress && alreadyPassed && assessment.isScored)
    blockedReason = "already_passed";
  // Prerequisite chain (final exam only): lessons ✓ + module tests ✓ (spec 1.4).
  else if (isFinal && !inProgress && prereq && !prereq.unlocked)
    blockedReason = prereq.lessons.allComplete
      ? "module_tests_incomplete"
      : "lessons_incomplete";
  else if (!inProgress && attemptsLeft === 0) blockedReason = "no_attempts_left";
  else if (!inProgress && cooldownUntil && Date.now() < cooldownUntil)
    blockedReason = "cooldown";

  return {
    assessment,
    questionCount,
    attemptsUsed,
    attemptsLeft,
    alreadyPassed,
    bestScorePct,
    inProgress,
    canStart: blockedReason === null || inProgress,
    blockedReason: inProgress ? null : blockedReason,
    cooldownUntil,
    prereq,
    retryRequested,
    history: submitted
      .slice()
      .sort((a, b) => b.submittedAt!.getTime() - a.submittedAt!.getTime())
      .slice(0, 5)
      .map((a) => ({
        attemptNo: a.attemptNo,
        scorePct: a.scorePct,
        passed: Boolean(a.passed),
        submittedAt: a.submittedAt!.getTime(),
      })),
  };
}

export type FinalExamBox = {
  assessmentId: string;
  title: LocalizedText;
  questionCount: number;
  passThresholdPct: number;
  state: "ready" | "passed" | "locked" | "needs_approval";
  /** Lessons progress for the lock hint (spec 3.2). */
  lessonsDone: number;
  lessonsTotal: number;
};

/**
 * Compact state for the player sidebar's terminal "final exam" box (spec 3.2).
 * Returns null when the course has no final exam. Fully server-computed so the
 * locked state can't be revealed client-side.
 */
export async function getFinalExamBox(
  courseId: string,
  userId: string,
): Promise<FinalExamBox | null> {
  const finalExam = await assessmentsRepository.findByTypeForCourse(
    courseId,
    "final_exam",
  );
  if (!finalExam || !finalExam.isPublished) return null;

  const overview = await getExamOverview(finalExam.id, userId);
  if (!overview) return null;

  let state: FinalExamBox["state"];
  if (overview.alreadyPassed) state = "passed";
  else if (
    overview.blockedReason === "lessons_incomplete" ||
    overview.blockedReason === "module_tests_incomplete"
  )
    state = "locked";
  else if (overview.blockedReason === "no_attempts_left")
    state = "needs_approval";
  else state = "ready";

  return {
    assessmentId: finalExam.id,
    title: finalExam.title,
    questionCount: overview.questionCount,
    passThresholdPct: finalExam.passThresholdPct,
    state,
    lessonsDone: overview.prereq?.lessons.completed ?? 0,
    lessonsTotal: overview.prereq?.lessons.total ?? 0,
  };
}

/** Start a new attempt or resume an in-progress one. Throws on block. */
export async function startOrResumeAttempt(
  assessmentId: string,
  userId: string,
): Promise<string> {
  const overview = await getExamOverview(assessmentId, userId);
  if (!overview) throw new Error("Assessment not found");
  if (overview.inProgress) {
    const existing = await attemptsRepository.findInProgress(userId, assessmentId);
    if (existing) return existing.id;
  }
  if (!overview.canStart) {
    throw new Error(`blocked:${overview.blockedReason}`);
  }
  const attempt = await attemptsRepository.start(userId, assessmentId);
  return attempt.id;
}

/**
 * Student "request exam access" (spec 1.5): only meaningful when out of
 * attempts and not yet passed. Records an admin-visible audit signal. Does not
 * grant anything — an admin voids an attempt to unlock one more. Idempotent per
 * (student, assessment) since the last attempt.
 */
export async function requestRetryApproval(
  assessmentId: string,
  userId: string,
): Promise<{ ok: boolean; alreadyRequested?: boolean }> {
  const overview = await getExamOverview(assessmentId, userId);
  if (!overview) return { ok: false };
  // Only allow when genuinely exhausted and not passed.
  if (overview.blockedReason !== "no_attempts_left") return { ok: false };
  if (overview.retryRequested) return { ok: true, alreadyRequested: true };

  await auditRepository.record({
    actorUserId: userId,
    action: "attempt.retry_requested",
    entityType: "assessment",
    entityId: assessmentId,
    meta: { courseId: overview.assessment.courseId },
  });
  return { ok: true };
}

async function loadOwnedAttempt(attemptId: string, userId: string) {
  const attempt = await attemptsRepository.findById(attemptId);
  if (!attempt || attempt.userId !== userId) throw new Error("Attempt not found");
  const assessment = await assessmentsRepository.findById(attempt.assessmentId);
  if (!assessment) throw new Error("Assessment not found");
  return { attempt, assessment };
}

/**
 * The questions actually served to this attempt: a deterministic per-attempt
 * subset (when `questions_to_serve` is set) in the attempt's display order.
 * Must be used identically for the runner, grading, and review so the three
 * always agree on the same set.
 */
function servedQuestions(
  qs: QuestionWithOptions[],
  attempt: { id: string },
  assessment: Assessment,
): QuestionWithOptions[] {
  const n = assessment.questionsToServe;
  const pool =
    n && n > 0 && n < qs.length
      ? orderQuestionsForAttempt(qs, `${attempt.id}:serve`, true).slice(0, n)
      : qs;
  return orderQuestionsForAttempt(pool, attempt.id, assessment.randomize);
}

export async function getRunnerState(attemptId: string, userId: string) {
  const { attempt, assessment } = await loadOwnedAttempt(attemptId, userId);
  const qs = await questionsRepository.listByAssessment(assessment.id);
  const ordered = servedQuestions(qs, attempt, assessment);
  const answers = await attemptsRepository.listAnswers(attempt.id);
  const answerMap: Record<string, string[]> = {};
  for (const a of answers) answerMap[a.questionId] = a.selectedOptionIds;

  const { endsAt } = timeWindow(assessment, attempt.startedAt);
  const runnerQuestions: RunnerQuestion[] = ordered.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    points: q.points ?? 1,
    options: q.options.map((o) => ({ id: o.id, label: o.label })),
  }));

  return {
    assessment,
    submitted: Boolean(attempt.submittedAt),
    questions: runnerQuestions,
    answers: answerMap,
    endsAt, // unix ms or null
  };
}

export async function saveAnswer(
  attemptId: string,
  userId: string,
  questionId: string,
  selectedOptionIds: string[],
): Promise<{ ok: boolean; expired?: boolean }> {
  const { attempt, assessment } = await loadOwnedAttempt(attemptId, userId);
  if (attempt.submittedAt) return { ok: false };
  const { expired } = timeWindow(assessment, attempt.startedAt);
  if (expired) return { ok: false, expired: true };
  const belongs = await questionsRepository.belongsToAssessment(
    questionId,
    assessment.id,
  );
  if (!belongs) return { ok: false };
  await attemptsRepository.upsertAnswer(attempt.id, questionId, selectedOptionIds);
  return { ok: true };
}

/** Grade + finalize. Idempotent: re-submitting a submitted attempt is a no-op. */
export async function submitAttempt(attemptId: string, userId: string) {
  const { attempt, assessment } = await loadOwnedAttempt(attemptId, userId);
  if (attempt.submittedAt) {
    return { scorePct: attempt.scorePct ?? 0, passed: Boolean(attempt.passed) };
  }
  const qs = await questionsRepository.listByAssessment(assessment.id);
  const served = servedQuestions(qs, attempt, assessment);
  const answers = await attemptsRepository.listAnswers(attempt.id);
  const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedOptionIds]));

  const result = grade(served, answerMap);
  for (const pq of result.perQuestion) {
    if (answerMap.has(pq.questionId)) {
      await attemptsRepository.setAnswerCorrectness(
        attempt.id,
        pq.questionId,
        pq.correct,
      );
    }
  }
  // Unscored (mock) attempts always "pass" the gate but aren't graded for access.
  const passed = assessment.isScored
    ? result.scorePct >= assessment.passThresholdPct
    : true;
  await attemptsRepository.submit(attempt.id, result.scorePct, passed);

  // Passing a (scored) final exam auto-issues the completion certificate.
  // Best-effort: a certificate failure must never break exam submission.
  if (passed && assessment.isScored && assessment.type === "final_exam") {
    try {
      await issueIfEligible(userId, assessment.courseId);
    } catch (err) {
      console.error("auto-issue certificate failed (non-fatal):", err);
    }
  }

  return { scorePct: result.scorePct, passed };
}

/**
 * Result + answer review. Review (correct answers + explanations) is only
 * exposed once the student has passed (B16) — or for unscored mock exams.
 */
export type ModuleBreakdownRow = {
  moduleId: string | null;
  title: LocalizedText | null;
  earnedPoints: number;
  totalPoints: number;
  pct: number;
};

export async function getResult(attemptId: string, userId: string) {
  const { attempt, assessment } = await loadOwnedAttempt(attemptId, userId);
  if (!attempt.submittedAt) return null;

  const passedSomewhere = (
    await attemptsRepository.listForUser(userId, assessment.id)
  ).some((a) => a.passed);
  const reviewAllowed = !assessment.isScored || passedSomewhere;

  const qs = await questionsRepository.listByAssessment(assessment.id);
  const answers = await attemptsRepository.listAnswers(attempt.id);
  const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedOptionIds]));
  const served = servedQuestions(qs, attempt, assessment);
  const graded = grade(served, answerMap);

  // Correct count + time spent (spec 2.4).
  const correctCount = graded.correctCount;
  const totalCount = graded.total;
  const timeSpentSeconds = attempt.submittedAt
    ? Math.max(0, Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000))
    : 0;

  // Per-module breakdown — informational only (the overall % decides pass/fail).
  const correctById = new Map(graded.perQuestion.map((p) => [p.questionId, p.correct]));
  const buckets = new Map<string, { earned: number; total: number }>();
  for (const q of served) {
    const key = q.moduleId ?? "__none__";
    const b = buckets.get(key) ?? { earned: 0, total: 0 };
    const pts = q.points ?? 1;
    b.total += pts;
    if (correctById.get(q.id)) b.earned += pts;
    buckets.set(key, b);
  }
  const hasTaggedModule = served.some((q) => q.moduleId);
  let moduleBreakdown: ModuleBreakdownRow[] = [];
  if (hasTaggedModule) {
    const modules = await modulesRepository.listByCourse(assessment.courseId);
    const titleById = new Map(modules.map((m) => [m.id, m.title]));
    moduleBreakdown = [...buckets.entries()].map(([key, b]) => ({
      moduleId: key === "__none__" ? null : key,
      title: key === "__none__" ? null : titleById.get(key) ?? null,
      earnedPoints: b.earned,
      totalPoints: b.total,
      pct: b.total === 0 ? 0 : Math.round((b.earned / b.total) * 100),
    }));
  }

  const result = {
    scorePct: attempt.scorePct ?? 0,
    passed: Boolean(attempt.passed),
    passThresholdPct: assessment.passThresholdPct,
    isScored: assessment.isScored,
    reviewAllowed,
    correctCount,
    totalCount,
    timeSpentSeconds,
    moduleBreakdown,
    review: null as
      | null
      | {
          prompt: LocalizedText;
          explanation: LocalizedText | null;
          options: { id: string; label: LocalizedText; isCorrect: boolean }[];
          selected: string[];
          correct: boolean;
        }[],
  };

  if (reviewAllowed) {
    result.review = served.map((q) => ({
      prompt: q.prompt,
      explanation: q.explanation,
      options: q.options.map((o) => ({ id: o.id, label: o.label, isCorrect: o.isCorrect })),
      selected: answerMap.get(q.id) ?? [],
      correct: correctById.get(q.id) ?? false,
    }));
  }
  return { assessment, ...result };
}

export { type Assessment };

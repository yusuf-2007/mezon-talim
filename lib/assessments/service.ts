import "server-only";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { questionsRepository } from "@/lib/db/repositories/questions";
import { attemptsRepository } from "@/lib/db/repositories/attempts";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import type { LocalizedText } from "@/lib/db/schema";
import { grade, orderQuestionsForAttempt } from "./grading";
import { issueIfEligible } from "@/lib/certificates/service";

type Assessment = NonNullable<
  Awaited<ReturnType<typeof assessmentsRepository.findById>>
>;

/** Question as exposed to the runner — correct flags stripped. */
export type RunnerQuestion = {
  id: string;
  type: "single" | "multiple" | "true_false";
  prompt: LocalizedText;
  options: { id: string; label: LocalizedText }[];
};

export type BlockReason =
  | "not_enrolled"
  | "already_passed"
  | "no_attempts_left"
  | "cooldown";

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

  const [questionCount, all, enrolled] = await Promise.all([
    questionsRepository.countByAssessment(assessmentId),
    attemptsRepository.listForUser(userId, assessmentId),
    enrollmentsRepository.isActive(userId, assessment.courseId),
  ]);

  const submitted = all.filter((a) => a.submittedAt);
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

  // Cooldown from the most recent submitted attempt.
  let cooldownUntil: number | null = null;
  if (assessment.attemptCooldownHours && submitted.length > 0) {
    const last = submitted.reduce((a, b) =>
      (a.submittedAt! > b.submittedAt! ? a : b),
    );
    cooldownUntil =
      last.submittedAt!.getTime() + assessment.attemptCooldownHours * 3600_000;
  }

  let blockedReason: BlockReason | null = null;
  if (!enrolled) blockedReason = "not_enrolled";
  else if (!inProgress && alreadyPassed && assessment.isScored)
    blockedReason = "already_passed";
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

async function loadOwnedAttempt(attemptId: string, userId: string) {
  const attempt = await attemptsRepository.findById(attemptId);
  if (!attempt || attempt.userId !== userId) throw new Error("Attempt not found");
  const assessment = await assessmentsRepository.findById(attempt.assessmentId);
  if (!assessment) throw new Error("Assessment not found");
  return { attempt, assessment };
}

export async function getRunnerState(attemptId: string, userId: string) {
  const { attempt, assessment } = await loadOwnedAttempt(attemptId, userId);
  const qs = await questionsRepository.listByAssessment(assessment.id);
  const ordered = orderQuestionsForAttempt(qs, attempt.id, assessment.randomize);
  const answers = await attemptsRepository.listAnswers(attempt.id);
  const answerMap: Record<string, string[]> = {};
  for (const a of answers) answerMap[a.questionId] = a.selectedOptionIds;

  const { endsAt } = timeWindow(assessment, attempt.startedAt);
  const runnerQuestions: RunnerQuestion[] = ordered.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
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
  const answers = await attemptsRepository.listAnswers(attempt.id);
  const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedOptionIds]));

  const result = grade(qs, answerMap);
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
export async function getResult(attemptId: string, userId: string) {
  const { attempt, assessment } = await loadOwnedAttempt(attemptId, userId);
  if (!attempt.submittedAt) return null;

  const passedSomewhere = (
    await attemptsRepository.listForUser(userId, assessment.id)
  ).some((a) => a.passed);
  const reviewAllowed = !assessment.isScored || passedSomewhere;

  const result = {
    scorePct: attempt.scorePct ?? 0,
    passed: Boolean(attempt.passed),
    passThresholdPct: assessment.passThresholdPct,
    isScored: assessment.isScored,
    reviewAllowed,
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
    const qs = await questionsRepository.listByAssessment(assessment.id);
    const answers = await attemptsRepository.listAnswers(attempt.id);
    const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedOptionIds]));
    result.review = orderQuestionsForAttempt(qs, attempt.id, assessment.randomize).map(
      (q) => ({
        prompt: q.prompt,
        explanation: q.explanation,
        options: q.options.map((o) => ({ id: o.id, label: o.label, isCorrect: o.isCorrect })),
        selected: answerMap.get(q.id) ?? [],
        correct: q.options
          .filter((o) => o.isCorrect)
          .every((o) => (answerMap.get(q.id) ?? []).includes(o.id)) &&
          (answerMap.get(q.id) ?? []).length ===
            q.options.filter((o) => o.isCorrect).length,
      }),
    );
  }
  return { assessment, ...result };
}

export { type Assessment };

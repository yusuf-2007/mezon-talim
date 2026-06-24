import { createHash } from "node:crypto";
import type { QuestionWithOptions } from "@/lib/db/repositories/questions";

/** Correct option ids for a question. */
export function correctOptionIds(q: QuestionWithOptions): string[] {
  return q.options.filter((o) => o.isCorrect).map((o) => o.id);
}

/**
 * A question is correct when the selected set exactly equals the correct set.
 * Works for single, true_false (one correct) and multiple (exact match).
 */
export function isAnswerCorrect(
  q: QuestionWithOptions,
  selected: string[],
): boolean {
  const correct = correctOptionIds(q);
  if (selected.length !== correct.length) return false;
  const sel = new Set(selected);
  return correct.every((id) => sel.has(id));
}

export type GradeResult = {
  scorePct: number;
  correctCount: number;
  total: number;
  perQuestion: { questionId: string; correct: boolean }[];
};

/** Grade an attempt: equal weight per question, integer percentage. */
export function grade(
  qs: QuestionWithOptions[],
  answers: Map<string, string[]>,
): GradeResult {
  const perQuestion = qs.map((q) => ({
    questionId: q.id,
    correct: isAnswerCorrect(q, answers.get(q.id) ?? []),
  }));
  const correctCount = perQuestion.filter((p) => p.correct).length;
  const total = qs.length;
  const scorePct = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  return { scorePct, correctCount, total, perQuestion };
}

/**
 * Deterministic per-attempt question order: stable across reloads/navigations
 * without persisting the order. When `randomize` is off, falls back to the
 * authored order_index.
 */
export function orderQuestionsForAttempt(
  qs: QuestionWithOptions[],
  attemptId: string,
  randomize: boolean,
): QuestionWithOptions[] {
  if (!randomize) return [...qs].sort((a, b) => a.orderIndex - b.orderIndex);
  const keyed = qs.map((q) => ({
    q,
    k: createHash("sha256").update(`${attemptId}:${q.id}`).digest("hex"),
  }));
  keyed.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  return keyed.map((x) => x.q);
}

"use server";

import { requireUser } from "@/lib/auth";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { checkExamRateLimit } from "@/lib/rate-limit";
import {
  requestRetryApproval,
  saveAnswer,
  startOrResumeAttempt,
  submitAttempt,
} from "./service";

/** Begin/resume an attempt and go to the runner; on block, back to pre-exam. */
export async function startExamAction(assessmentId: string): Promise<void> {
  const user = await requireUser();
  if (!checkExamRateLimit("start", user.id).ok) {
    return redirectLocalized(`/exam/${assessmentId}`);
  }
  try {
    const attemptId = await startOrResumeAttempt(assessmentId, user.id);
    return redirectLocalized(`/exam/attempt/${attemptId}`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("blocked:")) {
      return redirectLocalized(`/exam/${assessmentId}`);
    }
    throw e;
  }
}

/** Autosave a single answer from the runner. */
export async function saveAnswerAction(
  attemptId: string,
  questionId: string,
  selectedOptionIds: string[],
): Promise<{ ok: boolean; expired?: boolean }> {
  const user = await requireUser();
  if (!checkExamRateLimit("save", user.id).ok) return { ok: false };
  return saveAnswer(attemptId, user.id, questionId, selectedOptionIds);
}

/** Submit (manually or on time-expiry) → grade → result page. */
export async function submitExamAction(attemptId: string): Promise<void> {
  const user = await requireUser();
  if (!checkExamRateLimit("submit", user.id).ok) {
    return redirectLocalized(`/exam/attempt/${attemptId}`);
  }
  await submitAttempt(attemptId, user.id);
  return redirectLocalized(`/exam/attempt/${attemptId}/result`);
}

/**
 * Student "request exam access" when out of attempts (spec 1.5). Records a
 * notification for admins; does NOT grant anything (admin voids an attempt to
 * unlock one more). Returns a serializable result for the client.
 */
export async function requestRetryAction(
  assessmentId: string,
): Promise<{ ok: boolean; alreadyRequested?: boolean }> {
  const user = await requireUser();
  if (!checkExamRateLimit("retry", user.id).ok) return { ok: false };
  return requestRetryApproval(assessmentId, user.id);
}

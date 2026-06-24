"use server";

import { requireUser } from "@/lib/auth";
import { redirectLocalized } from "@/lib/i18n/redirect";
import {
  saveAnswer,
  startOrResumeAttempt,
  submitAttempt,
} from "./service";

/** Begin/resume an attempt and go to the runner; on block, back to pre-exam. */
export async function startExamAction(assessmentId: string): Promise<void> {
  const user = await requireUser();
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
  return saveAnswer(attemptId, user.id, questionId, selectedOptionIds);
}

/** Submit (manually or on time-expiry) → grade → result page. */
export async function submitExamAction(attemptId: string): Promise<void> {
  const user = await requireUser();
  await submitAttempt(attemptId, user.id);
  return redirectLocalized(`/exam/attempt/${attemptId}/result`);
}

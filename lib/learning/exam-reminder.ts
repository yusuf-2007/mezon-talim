import "server-only";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { attemptsRepository } from "@/lib/db/repositories/attempts";
import { notifyExamReminder } from "@/lib/notifications/service";
import { getCurriculum } from "./curriculum";

/**
 * Fire the exam-reminder SMS (B30) at the one moment it is useful: the student
 * has just finished the last lesson, the course has a scored final exam, and
 * they have not passed it. Everything else — no exam, already passed, still
 * lessons left — is silence. Best-effort and never throws into the caller.
 */
export async function remindFinalExamIfDue(
  userId: string,
  courseId: string,
): Promise<void> {
  try {
    const curriculum = await getCurriculum(courseId, userId);
    if (curriculum.lessonCount === 0) return;
    if (curriculum.completedCount < curriculum.lessonCount) return;

    const exam = await assessmentsRepository.findByTypeForCourse(courseId, "final_exam");
    if (!exam || !exam.isScored) return;

    const attempts = await attemptsRepository.listForUser(userId, exam.id);
    if (attempts.some((a) => a.passed)) return;

    await notifyExamReminder(userId, courseId);
  } catch (err) {
    console.error("exam reminder check failed (non-fatal):", err);
  }
}

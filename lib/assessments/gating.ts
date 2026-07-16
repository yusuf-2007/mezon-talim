import "server-only";
import { getCurriculum } from "@/lib/learning/curriculum";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { attemptsRepository } from "@/lib/db/repositories/attempts";

/**
 * Final-exam prerequisite chain (spec 1.4): the course final exam is locked
 * until BOTH are true — every lesson completed AND every *published* module
 * test passed. With no published module tests, that leg degrades to "no gate".
 *
 * The same chain gates certificate issuance (spec 1.6), so both callers share
 * these helpers to stay consistent.
 */

/** All non-preview-gated lessons in the course completed by the user. */
export async function allLessonsCompleted(
  userId: string,
  courseId: string,
): Promise<{ completed: number; total: number; allComplete: boolean }> {
  const c = await getCurriculum(courseId, userId);
  const total = c.lessonCount;
  const completed = c.completedCount;
  return { completed, total, allComplete: total > 0 && completed >= total };
}

/** Every published module test in the course has a passing attempt. */
export async function moduleTestsStatus(
  userId: string,
  courseId: string,
): Promise<{ passed: number; total: number; allPassed: boolean }> {
  const all = await assessmentsRepository.listByCourse(courseId);
  const moduleTests = all.filter(
    (a) => a.type === "module_test" && a.isPublished,
  );
  if (moduleTests.length === 0) {
    return { passed: 0, total: 0, allPassed: true }; // degrade to no-gate
  }
  const results = await Promise.all(
    moduleTests.map(async (mt) => {
      const attempts = await attemptsRepository.listForUser(userId, mt.id);
      return attempts.some((a) => a.passed);
    }),
  );
  const passed = results.filter(Boolean).length;
  return { passed, total: moduleTests.length, allPassed: passed === moduleTests.length };
}

export type ExamPrerequisites = {
  lessons: { completed: number; total: number; allComplete: boolean };
  moduleTests: { passed: number; total: number; allPassed: boolean };
  unlocked: boolean;
};

/** Combined prerequisite state for the final exam of a course. */
export async function getExamPrerequisites(
  userId: string,
  courseId: string,
): Promise<ExamPrerequisites> {
  const [lessons, moduleTests] = await Promise.all([
    allLessonsCompleted(userId, courseId),
    moduleTestsStatus(userId, courseId),
  ]);
  return {
    lessons,
    moduleTests,
    unlocked: lessons.allComplete && moduleTests.allPassed,
  };
}

import "server-only";
import { getCurriculum, type Curriculum } from "@/lib/learning/curriculum";
import {
  moduleLessonsFromCurriculum,
  type ModuleLessonsStatus,
} from "@/lib/learning/modules";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { attemptsRepository } from "@/lib/db/repositories/attempts";

/**
 * Final-exam prerequisite chain (spec 1.4): the course final exam is locked
 * until BOTH are true — every lesson completed AND every *published* module
 * test passed. With no published module tests, that leg degrades to "no gate".
 *
 * The same chain gates certificate issuance (spec 1.6), so both callers share
 * these helpers to stay consistent. "Passed" everywhere means a counted pass
 * (submitted, passed, not voided — lib/assessments/passed.ts).
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

/**
 * Lesson status of one module for a user (see lib/learning/modules.ts for the
 * rule). Pass `curriculum` when the caller already has it, to skip a reload.
 */
export async function moduleLessonsStatus(
  userId: string,
  courseId: string,
  moduleId: string,
  curriculum?: Curriculum,
): Promise<ModuleLessonsStatus> {
  const c = curriculum ?? (await getCurriculum(courseId, userId));
  return moduleLessonsFromCurriculum(c, moduleId);
}

export type ModuleTestPassState = {
  assessmentId: string;
  moduleId: string | null;
  passed: boolean;
};

/** Every published module test in the course has a counted pass. */
export async function moduleTestsStatus(
  userId: string,
  courseId: string,
): Promise<{
  passed: number;
  total: number;
  allPassed: boolean;
  tests: ModuleTestPassState[];
}> {
  const all = await assessmentsRepository.listByCourse(courseId);
  const moduleTests = all.filter(
    (a) => a.type === "module_test" && a.isPublished,
  );
  if (moduleTests.length === 0) {
    return { passed: 0, total: 0, allPassed: true, tests: [] }; // degrade to no-gate
  }
  const passedIds = await attemptsRepository.passedAssessmentIds(
    userId,
    moduleTests.map((t) => t.id),
  );
  const tests = moduleTests.map((t) => ({
    assessmentId: t.id,
    moduleId: t.moduleId,
    passed: passedIds.has(t.id),
  }));
  const passed = tests.filter((t) => t.passed).length;
  return { passed, total: moduleTests.length, allPassed: passed === moduleTests.length, tests };
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
    moduleTests: {
      passed: moduleTests.passed,
      total: moduleTests.total,
      allPassed: moduleTests.allPassed,
    },
    unlocked: lessons.allComplete && moduleTests.allPassed,
  };
}

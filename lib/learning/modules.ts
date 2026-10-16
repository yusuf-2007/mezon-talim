import type { Curriculum } from "./curriculum";

/**
 * Per-module lesson status — the one rule shared by the module-exam lock
 * (getExamOverview), module-certificate eligibility and the dashboard, so the
 * three can never disagree. Pure over an already-loaded curriculum (which
 * already leaves out soft-deleted lessons).
 *
 * `allComplete` mirrors the course rule: it needs at least one lesson. An
 * empty module is therefore never "complete" (it issues no certificate), but
 * its exam is NOT locked either — see `moduleExamLocked` — so an empty module
 * can never make the final exam unreachable.
 */
export type ModuleLessonsStatus = {
  completed: number;
  total: number;
  allComplete: boolean;
};

export function moduleLessonsFromCurriculum(
  c: Curriculum,
  moduleId: string,
): ModuleLessonsStatus {
  const m = c.modules.find((x) => x.id === moduleId);
  const total = m?.lessons.length ?? 0;
  const completed = m?.lessons.filter((l) => l.completed).length ?? 0;
  return { completed, total, allComplete: total > 0 && completed >= total };
}

/** The module exam waits for the module's lessons (an empty module: open). */
export function moduleExamLocked(s: ModuleLessonsStatus): boolean {
  return s.total > 0 && !s.allComplete;
}

/**
 * Whether a course issues module certificates at all: both the course-wide
 * certificate switch and the module-certificate switch must be on. Module
 * exams exist and gate the final either way.
 */
export function moduleCertificatesActive(course: {
  certificateEnabled: boolean;
  moduleCertificatesEnabled: boolean;
}): boolean {
  return course.certificateEnabled && course.moduleCertificatesEnabled;
}

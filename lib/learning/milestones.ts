import "server-only";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { attemptsRepository } from "@/lib/db/repositories/attempts";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { questionsRepository } from "@/lib/db/repositories/questions";
import { isCountedPass } from "@/lib/assessments/passed";
import type { Curriculum } from "./curriculum";
import {
  moduleExamLocked,
  moduleLessonsFromCurriculum,
  type ModuleLessonsStatus,
} from "./modules";
import type { LocalizedText } from "@/lib/db/schema";

/**
 * The module exam as every learner surface shows it (course page path, the
 * lesson rail, the enrol card's next step). The public spec is always there;
 * `state` is null unless the viewer is enrolled — an anonymous visitor sees
 * what the exam is, never their standing on it.
 */
export type ModuleExamBox = {
  assessmentId: string;
  title: LocalizedText;
  questionCount: number;
  passThresholdPct: number;
  timeLimitSeconds: number | null;
  maxAttempts: number | null;
  state: "locked" | "ready" | "passed" | "needs_approval" | null;
  /** Any counted (submitted, non-voided) attempt — "not taken" vs "failed". */
  attempted: boolean;
  bestScorePct: number | null;
};

export type ModuleMilestone = {
  moduleId: string;
  /** 1-based position of the module in the course. */
  number: number;
  lessons: ModuleLessonsStatus;
  /** The module's published exam, or null (none, or not published yet). */
  exam: ModuleExamBox | null;
  /** The viewer's ACTIVE module certificate (enrolled viewers only). */
  certificate: { verificationCode: string; issuedAt: Date } | null;
};

/**
 * Module exams + module certificates for a course, for one viewer, in a fixed
 * number of queries (no per-module round trips: this runs on every lesson and
 * course-page render). Pure over the already-loaded curriculum for lesson
 * state, and the same lock rule as getExamOverview (`moduleExamLocked`), so a
 * row here can never say "ready" for an exam the exam page refuses.
 */
export async function getModuleMilestones(
  courseId: string,
  userId: string | null,
  curriculum: Curriculum,
): Promise<Map<string, ModuleMilestone>> {
  const withState = Boolean(userId) && curriculum.enrolled;
  const exams = await assessmentsRepository.listModuleExamsByCourse(courseId);
  const published = [...exams.values()].filter((a) => a.isPublished);
  const ids = published.map((a) => a.id);

  const [counts, attempts, certs] = await Promise.all([
    questionsRepository.countByAssessments(ids),
    withState ? attemptsRepository.listForUserAssessments(userId!, ids) : Promise.resolve([]),
    withState
      ? certificatesRepository.listModuleCertsForUserCourse(userId!, courseId)
      : Promise.resolve([]),
  ]);

  const out = new Map<string, ModuleMilestone>();
  curriculum.modules.forEach((m, i) => {
    const lessons = moduleLessonsFromCurriculum(curriculum, m.id);
    const a = exams.get(m.id);
    let exam: ModuleExamBox | null = null;
    if (a && a.isPublished) {
      const mine = attempts.filter((x) => x.assessmentId === a.id);
      // Voided attempts ("grant retry") never count — as on the exam page.
      const submitted = mine.filter((x) => x.submittedAt && !x.voided);
      const passed = submitted.some(isCountedPass);
      const inProgress = mine.some((x) => !x.submittedAt);
      const best = submitted.reduce<number | null>(
        (b, x) => (x.scorePct != null && (b == null || x.scorePct > b) ? x.scorePct : b),
        null,
      );
      let state: ModuleExamBox["state"] = null;
      if (withState) {
        if (passed) state = "passed";
        else if (!inProgress && moduleExamLocked(lessons)) state = "locked";
        else if (!inProgress && a.maxAttempts && submitted.length >= a.maxAttempts)
          state = "needs_approval";
        else state = "ready";
      }
      exam = {
        assessmentId: a.id,
        title: a.title,
        questionCount: counts.get(a.id) ?? 0,
        passThresholdPct: a.passThresholdPct,
        timeLimitSeconds: a.timeLimitSeconds,
        maxAttempts: a.maxAttempts,
        state,
        attempted: submitted.length > 0,
        bestScorePct: best,
      };
    }
    const cert = certs.find((c) => c.moduleId === m.id && !c.revokedAt) ?? null;
    out.set(m.id, {
      moduleId: m.id,
      number: i + 1,
      lessons,
      exam,
      certificate: cert ? { verificationCode: cert.verificationCode, issuedAt: cert.issuedAt } : null,
    });
  });
  return out;
}

/**
 * The module exam a student should sit next: the first module, in MODULE
 * order, whose exam is open to them ("ready") and not yet passed. Used by the
 * enrol card and the lesson player so "next" points at the milestone rather
 * than past it.
 */
export function nextModuleExam(
  milestones: Map<string, ModuleMilestone>,
): { assessmentId: string; moduleNumber: number } | null {
  const ordered = [...milestones.values()].sort((x, y) => x.number - y.number);
  for (const m of ordered) {
    if (m.exam?.state === "ready" && m.exam.questionCount > 0 && m.lessons.allComplete) {
      return { assessmentId: m.exam.assessmentId, moduleNumber: m.number };
    }
  }
  return null;
}

type ModuleCertListing = {
  id: string;
  verificationCode: string;
  issuedAt: Date;
  revokedAt: Date | null;
  moduleId: string | null;
  moduleTitle: LocalizedText | null;
  moduleOrder: number | null;
};

export type ModuleCertLedgerRow = {
  key: string;
  number: number | null;
  title: LocalizedText | null;
  status: "earned" | "revoked" | "pending_exam" | "pending_lessons" | "passed_pending";
  cert: { code: string; issuedAt: Date } | null;
  lessons: { done: number; total: number } | null;
};

/**
 * One course's module-certificate ledger for the student: every module that
 * can issue one (it has lessons and a published exam), in module order, with
 * its standing; then certificates whose module has since been deleted (their
 * snapshot title). A revoked certificate shows as revoked, never as earned.
 *
 * `milestones` is null when the student no longer has access to the course
 * (or the course stopped issuing module certificates): then only the
 * certificates actually held are listed.
 */
export function moduleCertLedger(
  certs: ModuleCertListing[],
  curriculum: Curriculum | null,
  milestones: Map<string, ModuleMilestone> | null,
): ModuleCertLedgerRow[] {
  const byModule = new Map<string, ModuleCertListing[]>();
  for (const c of certs) {
    if (!c.moduleId) continue;
    const list = byModule.get(c.moduleId) ?? [];
    list.push(c);
    byModule.set(c.moduleId, list);
  }
  // Active first, then the newest — the one certificate a module row shows.
  const pick = (list: ModuleCertListing[] | undefined) =>
    list
      ?.slice()
      .sort(
        (x, y) =>
          Number(x.revokedAt != null) - Number(y.revokedAt != null) ||
          y.issuedAt.getTime() - x.issuedAt.getTime(),
      )[0] ?? null;
  const toRow = (
    c: ModuleCertListing,
    number: number | null,
  ): ModuleCertLedgerRow => ({
    key: c.id,
    number,
    title: c.moduleTitle,
    status: c.revokedAt ? "revoked" : "earned",
    cert: { code: c.verificationCode, issuedAt: c.issuedAt },
    lessons: null,
  });

  const rows: ModuleCertLedgerRow[] = [];
  const shown = new Set<string>();
  if (curriculum) {
    curriculum.modules.forEach((m, i) => {
      const held = pick(byModule.get(m.id));
      const ms = milestones?.get(m.id);
      if (held) {
        rows.push(toRow(held, i + 1));
        shown.add(m.id);
        return;
      }
      if (!ms?.exam || ms.lessons.total === 0) return;
      rows.push({
        key: m.id,
        number: i + 1,
        title: m.title,
        status:
          ms.exam.state === "passed"
            ? "passed_pending"
            : ms.lessons.allComplete
              ? "pending_exam"
              : "pending_lessons",
        cert: null,
        lessons: { done: ms.lessons.completed, total: ms.lessons.total },
      });
    });
  }
  // Held certificates not placed above (module deleted, or no curriculum).
  const rest = [...byModule.entries()]
    .filter(([moduleId]) => !shown.has(moduleId))
    .map(([, list]) => pick(list)!)
    .concat(certs.filter((c) => !c.moduleId))
    .sort(
      (x, y) =>
        (x.moduleOrder ?? Infinity) - (y.moduleOrder ?? Infinity) ||
        x.issuedAt.getTime() - y.issuedAt.getTime(),
    );
  for (const c of rest) {
    const idx = curriculum && c.moduleId ? curriculum.modules.findIndex((m) => m.id === c.moduleId) : -1;
    rows.push(toRow(c, idx >= 0 ? idx + 1 : null));
  }
  return rows;
}

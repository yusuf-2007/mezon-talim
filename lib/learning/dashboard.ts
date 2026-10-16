import "server-only";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { attemptsRepository } from "@/lib/db/repositories/attempts";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { glossaryRepository } from "@/lib/db/repositories/glossary";
import { lessonProgressRepository } from "@/lib/db/repositories/lesson-progress";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { messagesRepository } from "@/lib/db/repositories/messages";
import { notesRepository } from "@/lib/db/repositories/notes";
import { questionsRepository } from "@/lib/db/repositories/questions";
import { appDayKey } from "@/lib/utils";
import { getCurriculum, type Curriculum } from "./curriculum";
import { moduleCertificatesActive } from "./modules";
import { getModuleMilestones, type ModuleMilestone } from "./milestones";
import type { LocalizedText } from "@/lib/db/schema";

/**
 * Everything the dashboard home view renders, assembled once.
 *
 * The view is a single screen answering one question — "what do I do next?" —
 * so it reads as one query rather than six components each fetching for
 * themselves. Every field is derived from real rows; where the design asked
 * for something we do not record, the shape changed rather than the number
 * being invented (see `week`).
 */

export type ModuleProgress = {
  id: string;
  label: string;
  title: LocalizedText;
  /**
   * certified | done | test-due | current | upcoming — drives the status word
   * and colour. "certified" = the module certificate is held (and outranks a
   * lesson added after issue: the certificate stays valid).
   */
  state: "certified" | "done" | "test_due" | "current" | "upcoming";
  completed: number;
  total: number;
  /** The module exam, when one is published (link target for "test due"). */
  examId: string | null;
  lessons: { id: string; title: LocalizedText; state: "done" | "current" | "locked" }[];
};

export type DashboardData = {
  course: { id: string; slug: string; title: LocalizedText } | null;
  curriculum: Curriculum | null;
  resume: {
    lessonId: string;
    title: LocalizedText;
    moduleTitle: LocalizedText;
    moduleIndex: number;
    positionSeconds: number;
    durationSeconds: number | null;
  } | null;
  modules: ModuleProgress[];
  nextAssessment: {
    id: string;
    kind: "module_test" | "final_exam";
    /** 1-based module position (module exams only). */
    moduleNumber: number | null;
    /** Passing it issues a module certificate (module exams, switches on). */
    earnsModuleCertificate: boolean;
    title: LocalizedText;
    questionCount: number;
    passThresholdPct: number;
    maxAttempts: number | null;
  } | null;
  /** Lessons completed per day, oldest → newest, always 7 entries. */
  week: { date: Date; count: number; isToday: boolean }[];
  latestQuestion: {
    lessonId: string;
    lessonTitle: LocalizedText;
    body: string;
    createdAt: Date;
    answered: boolean;
  } | null;
  certificate: {
    verificationCode: string;
    issuedAt: Date;
    courseTitle: LocalizedText;
  } | null;
  /** Module certificates held / issuable in the current course (null = none issued there). */
  moduleCertificates: { done: number; total: number } | null;
  termOfDay: { term: string; definition: LocalizedText } | null;
  noteCounts: { total: number; pinned: number };
};

/** The module a lesson belongs to, by scanning the curriculum once. */
function moduleOf(curriculum: Curriculum, lessonId: string) {
  for (let i = 0; i < curriculum.modules.length; i++) {
    const m = curriculum.modules[i];
    if (m.lessons.some((l) => l.id === lessonId)) return { module: m, index: i };
  }
  return null;
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const [enrolled, certs, week, noteCounts] = await Promise.all([
    enrollmentsRepository.listActiveWithCourse(userId),
    certificatesRepository.listForUserAll(userId),
    lessonProgressRepository.completionsByDay(userId, 7),
    notesRepository.countsForUser(userId),
  ]);

  // The "current" course is the most recently started one still unfinished;
  // failing that, the most recent of any. A dashboard that leads with a course
  // the student already finished would be answering the wrong question.
  const withProgress = await Promise.all(
    enrolled.map(async ({ course }) => {
      const curriculum = await getCurriculum(course.id, userId);
      return { course, curriculum };
    }),
  );
  const current =
    withProgress.find(
      (c) => c.curriculum.lessonCount > 0 && c.curriculum.completedCount < c.curriculum.lessonCount,
    ) ?? withProgress[0] ?? null;

  // The dashboard's "my certificate" is the course certificate: a module
  // certificate (a milestone) must not stand in for it.
  const activeCerts = certs.filter((c) => !c.revokedAt && c.kind === "course");
  const latestCert = activeCerts[0] ?? null;

  const base: DashboardData = {
    course: null,
    curriculum: null,
    resume: null,
    modules: [],
    nextAssessment: null,
    week: buildWeek(week),
    latestQuestion: null,
    certificate: latestCert
      ? {
          verificationCode: latestCert.verificationCode,
          issuedAt: latestCert.issuedAt,
          courseTitle: latestCert.courseTitle,
        }
      : null,
    termOfDay: null,
    noteCounts,
    moduleCertificates: null,
  };

  if (!current) return base;

  const { course, curriculum } = current;
  const resumeId = curriculum.resumeLessonId;
  const certsOn = moduleCertificatesActive(course);

  const [resumeLesson, milestones, threads, glossary] = await Promise.all([
    resumeId ? lessonsRepository.findById(resumeId) : Promise.resolve(null),
    getModuleMilestones(course.id, userId, curriculum),
    messagesRepository.listThreadsForStudent(userId),
    glossaryRepository.listForCourse(course.id),
  ]);
  const moduleStates = buildModules(curriculum, milestones, certsOn);
  const nextAssessment = await findNextAssessment(
    course.id,
    userId,
    curriculum,
    milestones,
    certsOn,
  );
  const issuable = [...milestones.values()].filter((m) => m.exam && m.lessons.total > 0);
  const heldModuleCerts = certs.filter(
    (c) => c.kind === "module" && c.courseId === course.id && !c.revokedAt,
  ).length;

  const position = resumeId
    ? await lessonProgressRepository.forLessons(userId, [resumeId])
    : [];

  const located = resumeId ? moduleOf(curriculum, resumeId) : null;
  const resumeMeta = curriculum.modules
    .flatMap((m) => m.lessons)
    .find((l) => l.id === resumeId);

  // Latest thread the student started, newest first; answered when anyone else
  // has replied after them.
  const mine = threads.filter((m) => m.senderId === userId);
  const last = mine[mine.length - 1] ?? null;
  const answered = last
    ? threads.some((m) => m.lessonId === last.lessonId && m.senderId !== userId && m.createdAt > last.createdAt)
    : false;

  return {
    ...base,
    course: { id: course.id, slug: course.slug, title: course.title },
    curriculum,
    resume:
      resumeId && located && resumeMeta
        ? {
            lessonId: resumeId,
            title: resumeMeta.title,
            moduleTitle: located.module.title,
            moduleIndex: located.index + 1,
            positionSeconds: position[0]?.lastPositionSeconds ?? 0,
            durationSeconds: resumeLesson?.durationSeconds ?? resumeMeta.durationSeconds,
          }
        : null,
    modules: moduleStates,
    nextAssessment,
    latestQuestion: last
      ? {
          lessonId: last.lessonId,
          lessonTitle: last.lessonTitle,
          body: last.body,
          createdAt: last.createdAt,
          answered,
        }
      : null,
    termOfDay: pickTermOfDay(glossary),
    moduleCertificates:
      (certsOn && issuable.length > 0) || heldModuleCerts > 0
        ? { done: heldModuleCerts, total: Math.max(issuable.length, heldModuleCerts) }
        : null,
  };
}

/** Per-module completion, plus whether its module exam is still outstanding. */
function buildModules(
  curriculum: Curriculum,
  milestones: Map<string, ModuleMilestone>,
  certsOn: boolean,
): ModuleProgress[] {
  let seenCurrent = false;
  return curriculum.modules.map((m, i) => {
    const total = m.lessons.length;
    const completed = m.lessons.filter((l) => l.completed).length;
    const ms = milestones.get(m.id);
    // Counted passes only (non-voided) — the same rule as the exam page.
    const testOutstanding = Boolean(ms?.exam) && ms?.exam?.state !== "passed";

    const lessons = m.lessons.map((l) => {
      const state: "done" | "current" | "locked" = l.completed
        ? "done"
        : l.id === curriculum.resumeLessonId
          ? "current"
          : "locked";
      return { id: l.id, title: l.title, state };
    });

    // "test_due" outranks "done": a finished module whose exam is unpassed is
    // the thing standing between the student and the final exam. A held
    // module certificate outranks both.
    let state: ModuleProgress["state"];
    if (certsOn && ms?.certificate) {
      state = "certified";
    } else if (completed === total && total > 0) {
      state = testOutstanding ? "test_due" : "done";
    } else if (!seenCurrent && completed > 0) {
      state = "current";
      seenCurrent = true;
    } else if (!seenCurrent && lessons.some((l) => l.state === "current")) {
      state = "current";
      seenCurrent = true;
    } else {
      state = "upcoming";
    }

    return {
      id: m.id,
      label: String(i + 1),
      title: m.title,
      state,
      completed,
      total,
      examId: ms?.exam?.assessmentId ?? null,
      lessons,
    };
  });
}

/**
 * The soonest thing to sit: an unpassed module exam whose lessons are done (in
 * MODULE order, not the order the exams were created), else the final exam.
 */
async function findNextAssessment(
  courseId: string,
  userId: string,
  curriculum: Curriculum,
  milestones: Map<string, ModuleMilestone>,
  certsOn: boolean,
): Promise<DashboardData["nextAssessment"]> {
  const ordered = [...milestones.values()].sort((x, y) => x.number - y.number);
  for (const m of ordered) {
    const e = m.exam;
    // Locked = its module's lessons are not done (the exam page's own lock).
    if (!e?.state || e.state === "passed" || e.state === "locked" || e.questionCount === 0) continue;
    return {
      id: e.assessmentId,
      kind: "module_test",
      moduleNumber: m.number,
      earnsModuleCertificate: certsOn && m.lessons.total > 0,
      title: e.title,
      questionCount: e.questionCount,
      passThresholdPct: e.passThresholdPct,
      maxAttempts: e.maxAttempts,
    };
  }

  const final = await assessmentsRepository.findByTypeForCourse(courseId, "final_exam");
  if (!final || !final.isPublished) return null;
  if (curriculum.completedCount < curriculum.lessonCount) return null;
  // Every module exam must be passed first — otherwise the final is locked.
  if (ordered.some((m) => m.exam && m.exam.state !== "passed")) return null;
  if (await attemptsRepository.hasPassed(userId, final.id)) return null;
  return {
    id: final.id,
    kind: "final_exam",
    moduleNumber: null,
    earnsModuleCertificate: false,
    title: final.title,
    questionCount: await questionsRepository.countByAssessment(final.id),
    passThresholdPct: final.passThresholdPct,
    maxAttempts: final.maxAttempts,
  };
}

/** Seven days ending today, zero-filled, oldest first. */
function buildWeek(rows: { day: string; count: number }[]) {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const out: { date: Date; count: number; isToday: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    // Keys come from Postgres bucketed to Tashkent, so build them the same way:
    // the server runs in UTC and would otherwise name the wrong day until 5am.
    const d = new Date(Date.now() - i * 86_400_000);
    out.push({ date: d, count: byDay.get(appDayKey(d)) ?? 0, isToday: i === 0 });
  }
  return out;
}

/**
 * A term chosen by the date, so it is stable for a whole day rather than
 * changing on every render — "term of the day" should mean it.
 */
function pickTermOfDay<T>(terms: T[]): T | null {
  if (terms.length === 0) return null;
  const epochDay = Math.floor(Date.now() / 86_400_000);
  return terms[epochDay % terms.length];
}

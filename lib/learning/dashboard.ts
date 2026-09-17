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
  /** done | test-due | current | upcoming — drives the status word and colour. */
  state: "done" | "test_due" | "current" | "upcoming";
  completed: number;
  total: number;
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

  const activeCerts = certs.filter((c) => !c.revokedAt);
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
  };

  if (!current) return base;

  const { course, curriculum } = current;
  const resumeId = curriculum.resumeLessonId;

  const [resumeLesson, moduleStates, nextAssessment, threads, glossary] = await Promise.all([
    resumeId ? lessonsRepository.findById(resumeId) : Promise.resolve(null),
    buildModules(course.id, userId, curriculum),
    findNextAssessment(course.id, userId, curriculum),
    messagesRepository.listThreadsForStudent(userId),
    glossaryRepository.listForCourse(course.id),
  ]);

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
  };
}

/** Per-module completion, plus whether its module test is still outstanding. */
async function buildModules(
  courseId: string,
  userId: string,
  curriculum: Curriculum,
): Promise<ModuleProgress[]> {
  const all = await assessmentsRepository.listByCourse(courseId);
  const moduleTests = all.filter((a) => a.type === "module_test" && a.isPublished);

  const passed = new Set<string>();
  await Promise.all(
    moduleTests.map(async (t) => {
      const attempts = await attemptsRepository.listForUser(userId, t.id);
      if (attempts.some((a) => a.passed)) passed.add(t.id);
    }),
  );

  let seenCurrent = false;
  return curriculum.modules.map((m, i) => {
    const total = m.lessons.length;
    const completed = m.lessons.filter((l) => l.completed).length;
    const test = moduleTests.find((t) => t.moduleId === m.id);
    const testOutstanding = Boolean(test) && !passed.has(test!.id);

    const lessons = m.lessons.map((l) => {
      const state: "done" | "current" | "locked" = l.completed
        ? "done"
        : l.id === curriculum.resumeLessonId
          ? "current"
          : "locked";
      return { id: l.id, title: l.title, state };
    });

    // "test_due" outranks "done": a finished module whose test is unpassed is
    // the thing standing between the student and the final exam.
    let state: ModuleProgress["state"];
    if (completed === total && total > 0) {
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

    return { id: m.id, label: String(i + 1), title: m.title, state, completed, total, lessons };
  });
}

/** The soonest thing to sit: an unpassed module test, else the final exam. */
async function findNextAssessment(courseId: string, userId: string, curriculum: Curriculum) {
  const all = await assessmentsRepository.listByCourse(courseId);
  const ordered = [
    ...all.filter((a) => a.type === "module_test" && a.isPublished),
    ...all.filter((a) => a.type === "final_exam" && a.isPublished),
  ];

  for (const a of ordered) {
    const attempts = await attemptsRepository.listForUser(userId, a.id);
    if (attempts.some((at) => at.passed)) continue;

    // A module test only counts once its own module's lessons are done.
    if (a.type === "module_test" && a.moduleId) {
      const m = curriculum.modules.find((x) => x.id === a.moduleId);
      if (!m || m.lessons.some((l) => !l.completed)) continue;
    }
    if (a.type === "final_exam" && curriculum.completedCount < curriculum.lessonCount) continue;

    return {
      id: a.id,
      title: a.title,
      questionCount: await questionsRepository.countByAssessment(a.id),
      passThresholdPct: a.passThresholdPct,
      maxAttempts: a.maxAttempts,
    };
  }
  return null;
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

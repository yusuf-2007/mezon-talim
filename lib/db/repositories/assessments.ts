import "server-only";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "../client";
import { assessments } from "../schema";
import type { LocalizedText } from "../schema";

type AssessmentType = "lesson_quiz" | "module_test" | "final_exam" | "mock_exam";

export type AssessmentInsert = {
  type: AssessmentType;
  courseId: string;
  moduleId?: string | null;
  lessonId?: string | null;
  title: LocalizedText;
  timeLimitSeconds?: number | null;
  passThresholdPct: number;
  maxAttempts?: number | null;
  attemptCooldownHours?: number | null;
  isScored: boolean;
  randomize: boolean;
  isPublished?: boolean;
  questionsToServe?: number | null;
};

export const assessmentsRepository = {
  async findById(id: string) {
    const [row] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, id))
      .limit(1);
    return row ?? null;
  },

  async listByCourse(courseId: string) {
    return db
      .select()
      .from(assessments)
      .where(eq(assessments.courseId, courseId))
      .orderBy(asc(assessments.createdAt));
  },

  async findForLesson(lessonId: string) {
    const [row] = await db
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.lessonId, lessonId),
          eq(assessments.type, "lesson_quiz"),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /**
   * THE module exam of a module. One per module is enforced by the Studio /
   * Admin actions, not the database (legacy rows cannot be audited from here),
   * so if several exist this picks deterministically: published first, then
   * the earliest created.
   */
  async findForModule(moduleId: string) {
    const [row] = await db
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.moduleId, moduleId),
          eq(assessments.type, "module_test"),
        ),
      )
      .orderBy(desc(assessments.isPublished), asc(assessments.createdAt), asc(assessments.id))
      .limit(1);
    return row ?? null;
  },

  /**
   * THE module exam of every module of a course, in one query — the same
   * deterministic pick as `findForModule` (published first, then the earliest
   * created, then id), so a legacy duplicate can never make two screens
   * disagree. Keyed by module id; may include unpublished exams (callers that
   * show exams to students filter on `isPublished`).
   */
  async listModuleExamsByCourse(courseId: string) {
    const rows = await db
      .select()
      .from(assessments)
      .where(and(eq(assessments.courseId, courseId), eq(assessments.type, "module_test")))
      .orderBy(desc(assessments.isPublished), asc(assessments.createdAt), asc(assessments.id));
    const byModule = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      if (r.moduleId && !byModule.has(r.moduleId)) byModule.set(r.moduleId, r);
    }
    return byModule;
  },

  /**
   * Another module exam already attached to `moduleId` (the one-per-module
   * rule), ignoring `exceptId` — the assessment being edited.
   */
  async findOtherModuleTest(moduleId: string, exceptId?: string) {
    const [row] = await db
      .select({ id: assessments.id })
      .from(assessments)
      .where(
        and(
          eq(assessments.moduleId, moduleId),
          eq(assessments.type, "module_test"),
          exceptId ? ne(assessments.id, exceptId) : undefined,
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /**
   * One assessment of a type for a course (e.g. its final exam). Deterministic
   * when legacy data has several: published first, then the earliest created.
   */
  async findByTypeForCourse(courseId: string, type: AssessmentType) {
    const [row] = await db
      .select()
      .from(assessments)
      .where(and(eq(assessments.courseId, courseId), eq(assessments.type, type)))
      .orderBy(desc(assessments.isPublished), asc(assessments.createdAt), asc(assessments.id))
      .limit(1);
    return row ?? null;
  },

  async create(input: AssessmentInsert) {
    const [row] = await db.insert(assessments).values(input).returning();
    return row;
  },

  async update(id: string, patch: Partial<AssessmentInsert>) {
    const [row] = await db
      .update(assessments)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(eq(assessments.id, id))
      .returning();
    return row;
  },

  async remove(id: string) {
    await db.delete(assessments).where(eq(assessments.id, id));
  },
};

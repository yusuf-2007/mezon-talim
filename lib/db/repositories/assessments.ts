import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
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
      .limit(1);
    return row ?? null;
  },

  async findByTypeForCourse(courseId: string, type: AssessmentType) {
    const [row] = await db
      .select()
      .from(assessments)
      .where(and(eq(assessments.courseId, courseId), eq(assessments.type, type)))
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

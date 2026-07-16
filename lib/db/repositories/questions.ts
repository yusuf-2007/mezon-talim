import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import { questionOptions, questions } from "../schema";
import type { LocalizedText } from "../schema";

type QuestionType = "single" | "multiple" | "true_false";

export type QuestionOptionInput = {
  label: LocalizedText;
  isCorrect: boolean;
};

export type QuestionInput = {
  type: QuestionType;
  prompt: LocalizedText;
  explanation?: LocalizedText | null;
  points?: number;
  moduleId?: string | null;
  options: QuestionOptionInput[];
};

export type QuestionWithOptions = typeof questions.$inferSelect & {
  options: (typeof questionOptions.$inferSelect)[];
};

/** Questions + their options (the question bank for an assessment). */
export const questionsRepository = {
  async listByAssessment(assessmentId: string): Promise<QuestionWithOptions[]> {
    const qs = await db
      .select()
      .from(questions)
      .where(eq(questions.assessmentId, assessmentId))
      .orderBy(asc(questions.orderIndex));
    if (qs.length === 0) return [];

    const opts = await db
      .select()
      .from(questionOptions)
      .where(
        inArray(
          questionOptions.questionId,
          qs.map((q) => q.id),
        ),
      )
      .orderBy(asc(questionOptions.orderIndex));

    const byQ = new Map<string, (typeof questionOptions.$inferSelect)[]>();
    for (const o of opts) {
      const list = byQ.get(o.questionId) ?? [];
      list.push(o);
      byQ.set(o.questionId, list);
    }
    return qs.map((q) => ({ ...q, options: byQ.get(q.id) ?? [] }));
  },

  async countByAssessment(assessmentId: string) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(eq(questions.assessmentId, assessmentId));
    return row?.count ?? 0;
  },

  async create(assessmentId: string, input: QuestionInput) {
    return db.transaction(async (tx) => {
      const [{ next }] = await tx
        .select({ next: sql<number>`coalesce(max(${questions.orderIndex}) + 1, 0)` })
        .from(questions)
        .where(eq(questions.assessmentId, assessmentId));
      const [q] = await tx
        .insert(questions)
        .values({
          assessmentId,
          orderIndex: next,
          type: input.type,
          prompt: input.prompt,
          explanation: input.explanation ?? null,
          points: input.points ?? 1,
          moduleId: input.moduleId ?? null,
        })
        .returning();
      await tx.insert(questionOptions).values(
        input.options.map((o, i) => ({
          questionId: q.id,
          orderIndex: i,
          label: o.label,
          isCorrect: o.isCorrect,
        })),
      );
      return q;
    });
  },

  async update(questionId: string, input: QuestionInput) {
    return db.transaction(async (tx) => {
      await tx
        .update(questions)
        .set({
          type: input.type,
          prompt: input.prompt,
          explanation: input.explanation ?? null,
          points: input.points ?? 1,
          moduleId: input.moduleId ?? null,
          updatedAt: sql`now()`,
        })
        .where(eq(questions.id, questionId));
      // Replace options wholesale (simplest correct authoring semantics).
      await tx
        .delete(questionOptions)
        .where(eq(questionOptions.questionId, questionId));
      await tx.insert(questionOptions).values(
        input.options.map((o, i) => ({
          questionId,
          orderIndex: i,
          label: o.label,
          isCorrect: o.isCorrect,
        })),
      );
    });
  },

  async remove(questionId: string) {
    await db.delete(questions).where(eq(questions.id, questionId));
  },

  async belongsToAssessment(questionId: string, assessmentId: string) {
    const [row] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(
        and(eq(questions.id, questionId), eq(questions.assessmentId, assessmentId)),
      )
      .limit(1);
    return Boolean(row);
  },
};

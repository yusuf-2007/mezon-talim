"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCourseEditor } from "@/lib/content/access";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { questionsRepository } from "@/lib/db/repositories/questions";
import type { LocalizedText } from "@/lib/db/schema";
import {
  assessmentUpsertSchema,
  questionMetaSchema,
} from "./schemas";

export type AssessFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

function fieldErrors(error: z.ZodError): AssessFormState {
  return {
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

function loc(uz: string, ru?: string): LocalizedText {
  return ru && ru.length > 0 ? { uz, ru } : { uz };
}
function optLoc(uz?: string, ru?: string): LocalizedText | null {
  if (!uz && !ru) return null;
  return loc(uz ?? "", ru);
}

// ── Assessment ───────────────────────────────────────────────────────────────

export async function createAssessmentAction(
  courseId: string,
  _prev: AssessFormState,
  formData: FormData,
): Promise<AssessFormState> {
  await requireCourseEditor(courseId);
  const parsed = assessmentUpsertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  const created = await assessmentsRepository.create({
    type: d.type,
    courseId,
    moduleId: d.type === "module_test" ? d.moduleId : null,
    lessonId: d.type === "lesson_quiz" ? d.lessonId : null,
    title: loc(d.titleUz, d.titleRu),
    timeLimitSeconds: d.timeLimitMinutes ? d.timeLimitMinutes * 60 : null,
    passThresholdPct: d.passThresholdPct,
    maxAttempts: d.maxAttempts,
    attemptCooldownHours: d.attemptCooldownHours,
    isScored: d.isScored,
    randomize: d.randomize,
  });
  revalidatePath(`/studio/courses/${courseId}/assessments`);
  return redirectLocalized(
    `/studio/courses/${courseId}/assessments/${created.id}`,
  );
}

export async function updateAssessmentAction(
  courseId: string,
  assessmentId: string,
  _prev: AssessFormState,
  formData: FormData,
): Promise<AssessFormState> {
  await requireCourseEditor(courseId);
  const parsed = assessmentUpsertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  await assessmentsRepository.update(assessmentId, {
    type: d.type,
    moduleId: d.type === "module_test" ? d.moduleId : null,
    lessonId: d.type === "lesson_quiz" ? d.lessonId : null,
    title: loc(d.titleUz, d.titleRu),
    timeLimitSeconds: d.timeLimitMinutes ? d.timeLimitMinutes * 60 : null,
    passThresholdPct: d.passThresholdPct,
    maxAttempts: d.maxAttempts,
    attemptCooldownHours: d.attemptCooldownHours,
    isScored: d.isScored,
    randomize: d.randomize,
  });
  revalidatePath(`/studio/courses/${courseId}/assessments/${assessmentId}`);
  return {};
}

export async function deleteAssessmentAction(
  courseId: string,
  assessmentId: string,
): Promise<void> {
  await requireCourseEditor(courseId);
  await assessmentsRepository.remove(assessmentId);
  revalidatePath(`/studio/courses/${courseId}/assessments`);
  return redirectLocalized(`/studio/courses/${courseId}/assessments`);
}

// ── Questions ────────────────────────────────────────────────────────────────

/** Parse the variable-length option rows from FormData. */
function parseOptions(formData: FormData) {
  const labelsUz = formData.getAll("optionUz").map((v) => String(v).trim());
  const labelsRu = formData.getAll("optionRu").map((v) => String(v).trim());
  const correct = new Set(formData.getAll("correct").map((v) => Number(v)));
  const options = labelsUz
    .map((uz, i) => ({
      label: loc(uz, labelsRu[i]),
      isCorrect: correct.has(i),
      uz,
    }))
    .filter((o) => o.uz.length > 0)
    .map(({ label, isCorrect }) => ({ label, isCorrect }));
  return options;
}

async function buildQuestionInput(formData: FormData) {
  const meta = questionMetaSchema.safeParse(Object.fromEntries(formData));
  if (!meta.success) return { error: fieldErrors(meta.error) as AssessFormState };
  const options = parseOptions(formData);
  if (options.length < 2) {
    return { error: { error: "Kamida 2 ta variant kerak" } as AssessFormState };
  }
  if (!options.some((o) => o.isCorrect)) {
    return { error: { error: "Kamida bitta to'g'ri javob belgilang" } as AssessFormState };
  }
  return {
    input: {
      type: meta.data.type,
      prompt: loc(meta.data.promptUz, meta.data.promptRu),
      explanation: optLoc(meta.data.explanationUz, meta.data.explanationRu),
      options,
    },
  };
}

export async function createQuestionAction(
  courseId: string,
  assessmentId: string,
  _prev: AssessFormState,
  formData: FormData,
): Promise<AssessFormState> {
  await requireCourseEditor(courseId);
  const built = await buildQuestionInput(formData);
  if (built.error) return built.error;
  await questionsRepository.create(assessmentId, built.input);
  revalidatePath(`/studio/courses/${courseId}/assessments/${assessmentId}`);
  return {};
}

export async function updateQuestionAction(
  courseId: string,
  assessmentId: string,
  questionId: string,
  _prev: AssessFormState,
  formData: FormData,
): Promise<AssessFormState> {
  await requireCourseEditor(courseId);
  if (!(await questionsRepository.belongsToAssessment(questionId, assessmentId))) {
    return { error: "Not found" };
  }
  const built = await buildQuestionInput(formData);
  if (built.error) return built.error;
  await questionsRepository.update(questionId, built.input);
  revalidatePath(`/studio/courses/${courseId}/assessments/${assessmentId}`);
  return {};
}

export async function deleteQuestionAction(
  courseId: string,
  assessmentId: string,
  questionId: string,
): Promise<void> {
  await requireCourseEditor(courseId);
  await questionsRepository.remove(questionId);
  revalidatePath(`/studio/courses/${courseId}/assessments/${assessmentId}`);
}

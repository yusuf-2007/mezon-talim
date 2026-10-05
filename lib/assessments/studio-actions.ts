"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  requireCourseEditor,
  requireLessonInCourse,
  requireModuleInCourse,
  type Ownership,
} from "@/lib/content/access";
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

// ── Ownership ────────────────────────────────────────────────────────────────
// requireCourseEditor authorizes ONE course, but these are public endpoints
// that can be called with any ids. Every assessment, question, module and
// lesson id handed in must belong to that course too, or an editor of course
// A could edit or delete course B's exams (same rule as lib/content/access).

const uuid = z.uuid();

type AssessmentRow = NonNullable<Awaited<ReturnType<typeof assessmentsRepository.findById>>>;

async function assessmentOwnership(
  assessmentId: string,
  courseId: string,
): Promise<{ owner: Ownership; assessment: AssessmentRow | null }> {
  if (!uuid.safeParse(assessmentId).success) return { owner: "missing", assessment: null };
  const assessment = await assessmentsRepository.findById(assessmentId);
  if (!assessment) return { owner: "missing", assessment };
  return { owner: assessment.courseId === courseId ? "ok" : "other", assessment };
}

/** 404 unless the assessment exists and belongs to the course. */
async function requireAssessmentInCourse(assessmentId: string, courseId: string) {
  const { owner, assessment } = await assessmentOwnership(assessmentId, courseId);
  if (owner !== "ok" || !assessment) notFound();
  return assessment;
}

/**
 * The module / lesson an assessment is attached to must be in the same
 * course, or its quiz would surface in another course's lesson. `current` is
 * what the assessment already points at: keeping it is always allowed (the
 * lesson may since have been soft-deleted).
 */
async function requireTargetsInCourse(
  courseId: string,
  target: { moduleId: string | null; lessonId: string | null },
  current?: { moduleId: string | null; lessonId: string | null },
) {
  if (target.moduleId && target.moduleId !== current?.moduleId) {
    await requireModuleInCourse(target.moduleId, courseId);
  }
  if (target.lessonId && target.lessonId !== current?.lessonId) {
    await requireLessonInCourse(target.lessonId, courseId);
  }
}

// ── Assessment ───────────────────────────────────────────────────────────────

export async function createAssessmentAction(
  basePath: string,
  courseId: string,
  _prev: AssessFormState,
  formData: FormData,
): Promise<AssessFormState> {
  await requireCourseEditor(courseId);
  const parsed = assessmentUpsertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  const moduleId = d.type === "module_test" ? d.moduleId : null;
  const lessonId = d.type === "lesson_quiz" ? d.lessonId : null;
  await requireTargetsInCourse(courseId, { moduleId, lessonId });

  const created = await assessmentsRepository.create({
    type: d.type,
    courseId,
    moduleId,
    lessonId,
    title: loc(d.titleUz, d.titleRu),
    timeLimitSeconds: d.timeLimitMinutes ? d.timeLimitMinutes * 60 : null,
    passThresholdPct: d.passThresholdPct,
    maxAttempts: d.maxAttempts,
    attemptCooldownHours: d.attemptCooldownHours,
    isScored: d.isScored,
    randomize: d.randomize,
    isPublished: d.isPublished,
    questionsToServe: d.questionsToServe,
  });
  // basePath is "/studio" or "/admin" — both surfaces reuse this editor.
  revalidatePath(`${basePath}/courses/${courseId}/assessments`);
  return redirectLocalized(
    `${basePath}/courses/${courseId}/assessments/${created.id}`,
  );
}

export async function updateAssessmentAction(
  courseId: string,
  assessmentId: string,
  _prev: AssessFormState,
  formData: FormData,
): Promise<AssessFormState> {
  await requireCourseEditor(courseId);
  const current = await requireAssessmentInCourse(assessmentId, courseId);
  const parsed = assessmentUpsertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  const moduleId = d.type === "module_test" ? d.moduleId : null;
  const lessonId = d.type === "lesson_quiz" ? d.lessonId : null;
  await requireTargetsInCourse(courseId, { moduleId, lessonId }, current);

  await assessmentsRepository.update(assessmentId, {
    type: d.type,
    moduleId,
    lessonId,
    title: loc(d.titleUz, d.titleRu),
    timeLimitSeconds: d.timeLimitMinutes ? d.timeLimitMinutes * 60 : null,
    passThresholdPct: d.passThresholdPct,
    maxAttempts: d.maxAttempts,
    attemptCooldownHours: d.attemptCooldownHours,
    isScored: d.isScored,
    randomize: d.randomize,
    isPublished: d.isPublished,
    questionsToServe: d.questionsToServe,
  });
  revalidatePath(`/studio/courses/${courseId}/assessments/${assessmentId}`);
  return {};
}

export async function deleteAssessmentAction(
  basePath: string,
  courseId: string,
  assessmentId: string,
): Promise<void> {
  await requireCourseEditor(courseId);
  const { owner } = await assessmentOwnership(assessmentId, courseId);
  if (owner === "other") notFound();
  // "missing": already gone — a repeated delete just lands on the list again.
  if (owner === "ok") await assessmentsRepository.remove(assessmentId);
  revalidatePath(`${basePath}/courses/${courseId}/assessments`);
  return redirectLocalized(`${basePath}/courses/${courseId}/assessments`);
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

async function buildQuestionInput(formData: FormData, courseId: string) {
  const meta = questionMetaSchema.safeParse(Object.fromEntries(formData));
  if (!meta.success) return { error: fieldErrors(meta.error) as AssessFormState };
  // The module tag (for the per-module breakdown) must be one of this course's.
  if (meta.data.moduleId) await requireModuleInCourse(meta.data.moduleId, courseId);
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
      points: meta.data.points,
      moduleId: meta.data.moduleId,
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
  await requireAssessmentInCourse(assessmentId, courseId);
  const built = await buildQuestionInput(formData, courseId);
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
  await requireAssessmentInCourse(assessmentId, courseId);
  if (
    !uuid.safeParse(questionId).success ||
    !(await questionsRepository.belongsToAssessment(questionId, assessmentId))
  ) {
    return { error: "Not found" };
  }
  const built = await buildQuestionInput(formData, courseId);
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
  await requireAssessmentInCourse(assessmentId, courseId);
  // Only a question of THIS assessment is ever deleted. One that is not (gone
  // already, or another assessment's) is left alone: a repeated delete stays
  // a harmless no-op.
  if (
    uuid.safeParse(questionId).success &&
    (await questionsRepository.belongsToAssessment(questionId, assessmentId))
  ) {
    await questionsRepository.remove(questionId);
  }
  revalidatePath(`/studio/courses/${courseId}/assessments/${assessmentId}`);
}

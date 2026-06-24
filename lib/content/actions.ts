"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { requireCourseEditor } from "./access";
import { slugify, somToTiyin } from "./slug";
import {
  courseUpsertSchema,
  lessonUpsertSchema,
  moduleUpsertSchema,
} from "./schemas";
import type { LocalizedText } from "@/lib/db/schema";

export type ContentFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

function fieldErrors(error: z.ZodError): ContentFormState {
  return {
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

/** Build a LocalizedText, dropping an empty ru. */
function loc(uz: string, ru?: string): LocalizedText {
  return ru && ru.length > 0 ? { uz, ru } : { uz };
}

function optionalLoc(uz?: string, ru?: string): LocalizedText | null {
  if (!uz && !ru) return null;
  return loc(uz ?? "", ru);
}

// ── Course ───────────────────────────────────────────────────────────────────

export async function createCourseAction(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const user = await requireRole("teacher", "super_admin");
  const t = await getTranslations("Studio");

  const parsed = courseUpsertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  const slug = d.slug || slugify(d.titleUz);
  if (await coursesRepository.slugExists(slug)) {
    return { fieldErrors: { slug: [t("slugTaken")] } };
  }

  const course = await coursesRepository.create({
    slug,
    title: loc(d.titleUz, d.titleRu),
    summary: optionalLoc(d.summaryUz, d.summaryRu),
    description: optionalLoc(d.descriptionUz, d.descriptionRu),
    coverUrl: d.coverUrl || null,
    priceTiyin: somToTiyin(d.priceSom),
    accessDurationDays: d.accessDurationDays,
    passThresholdPct: d.passThresholdPct,
    certificateEnabled: d.certificateEnabled,
    createdBy: user.id,
  });

  revalidatePath("/studio");
  return redirectLocalized(`/studio/courses/${course.id}`);
}

export async function updateCourseAction(
  courseId: string,
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  await requireCourseEditor(courseId);
  const t = await getTranslations("Studio");

  const parsed = courseUpsertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  if (await coursesRepository.slugExists(d.slug, courseId)) {
    return { fieldErrors: { slug: [t("slugTaken")] } };
  }

  await coursesRepository.update(courseId, {
    slug: d.slug,
    title: loc(d.titleUz, d.titleRu),
    summary: optionalLoc(d.summaryUz, d.summaryRu),
    description: optionalLoc(d.descriptionUz, d.descriptionRu),
    coverUrl: d.coverUrl || null,
    priceTiyin: somToTiyin(d.priceSom),
    accessDurationDays: d.accessDurationDays,
    passThresholdPct: d.passThresholdPct,
    certificateEnabled: d.certificateEnabled,
  });

  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath("/studio");
  return {};
}

export async function setCourseStatusAction(
  courseId: string,
  status: "draft" | "published" | "archived",
): Promise<void> {
  await requireCourseEditor(courseId);
  await coursesRepository.setStatus(courseId, status);
  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath("/studio");
}

export async function deleteCourseAction(courseId: string): Promise<void> {
  await requireCourseEditor(courseId);
  await coursesRepository.softDelete(courseId);
  revalidatePath("/studio");
  return redirectLocalized("/studio");
}

// ── Module ───────────────────────────────────────────────────────────────────

export async function createModuleAction(
  courseId: string,
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  await requireCourseEditor(courseId);
  const parsed = moduleUpsertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  await modulesRepository.create(
    courseId,
    loc(parsed.data.titleUz, parsed.data.titleRu),
  );
  revalidatePath(`/studio/courses/${courseId}`);
  return {};
}

export async function updateModuleAction(
  courseId: string,
  moduleId: string,
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  await requireCourseEditor(courseId);
  const parsed = moduleUpsertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  await modulesRepository.update(
    moduleId,
    loc(parsed.data.titleUz, parsed.data.titleRu),
  );
  revalidatePath(`/studio/courses/${courseId}`);
  return {};
}

export async function deleteModuleAction(
  courseId: string,
  moduleId: string,
): Promise<void> {
  await requireCourseEditor(courseId);
  await modulesRepository.remove(moduleId);
  revalidatePath(`/studio/courses/${courseId}`);
}

// ── Lesson ───────────────────────────────────────────────────────────────────

export async function createLessonAction(
  courseId: string,
  moduleId: string,
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  await requireCourseEditor(courseId);
  const parsed = lessonUpsertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  await lessonsRepository.create({
    moduleId,
    title: loc(d.titleUz, d.titleRu),
    body: optionalLoc(d.bodyUz, d.bodyRu),
    bunnyVideoId: d.bunnyVideoId || null,
    durationSeconds: d.durationSeconds ?? null,
    isPreview: d.isPreview,
  });
  revalidatePath(`/studio/courses/${courseId}`);
  return {};
}

export async function updateLessonAction(
  courseId: string,
  lessonId: string,
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  await requireCourseEditor(courseId);
  const parsed = lessonUpsertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  await lessonsRepository.update(lessonId, {
    title: loc(d.titleUz, d.titleRu),
    body: optionalLoc(d.bodyUz, d.bodyRu),
    bunnyVideoId: d.bunnyVideoId || null,
    durationSeconds: d.durationSeconds ?? null,
    isPreview: d.isPreview,
  });
  revalidatePath(`/studio/courses/${courseId}`);
  return {};
}

export async function deleteLessonAction(
  courseId: string,
  lessonId: string,
): Promise<void> {
  await requireCourseEditor(courseId);
  await lessonsRepository.softDelete(lessonId);
  revalidatePath(`/studio/courses/${courseId}`);
}

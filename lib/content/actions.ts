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
  reorderSchema,
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

/**
 * Refresh both authoring surfaces after a curriculum write.
 *
 * The Studio and the Admin render the same CourseEditor at different paths, so
 * revalidating only /studio left an admin looking at their own stale edit.
 */
function revalidateCourse(courseId: string): void {
  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}`);
}

// ── Course ───────────────────────────────────────────────────────────────────

export async function createCourseAction(
  basePath: string,
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
    category: d.category || null,
    priceTiyin: somToTiyin(d.priceSom),
    accessDurationDays: d.accessDurationDays,
    passThresholdPct: d.passThresholdPct,
    certificateEnabled: d.certificateEnabled,
    createdBy: user.id,
  });

  // basePath is "/studio" or "/admin" — both surfaces reuse this create form.
  revalidatePath(basePath);
  return redirectLocalized(`${basePath}/courses/${course.id}`);
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
    category: d.category || null,
    priceTiyin: somToTiyin(d.priceSom),
    accessDurationDays: d.accessDurationDays,
    passThresholdPct: d.passThresholdPct,
    certificateEnabled: d.certificateEnabled,
  });

  revalidateCourse(courseId);
  revalidatePath("/studio");
  return {};
}

export async function setCourseStatusAction(
  courseId: string,
  status: "draft" | "published" | "archived",
): Promise<void> {
  await requireCourseEditor(courseId);
  await coursesRepository.setStatus(courseId, status);
  revalidateCourse(courseId);
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
  revalidateCourse(courseId);
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
  revalidateCourse(courseId);
  return {};
}

export async function deleteModuleAction(
  courseId: string,
  moduleId: string,
): Promise<void> {
  await requireCourseEditor(courseId);
  await modulesRepository.remove(moduleId);
  revalidateCourse(courseId);
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
  revalidateCourse(courseId);
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
  revalidateCourse(courseId);
  return {};
}

/**
 * Persist a drag-and-drop reordering of one module's lessons.
 *
 * Lesson order is the curriculum: `getCurriculum` flattens lessons in
 * order_index sequence to compute sequential unlock (B2), so this rewrites what
 * students may open next, not just a display list.
 *
 * Three checks before the write, because `lessonsRepository.reorder` scopes
 * only to the module and would otherwise trust whatever it is handed:
 *  - the module must belong to `courseId` (requireCourseEditor authorizes the
 *    course, so an unchecked moduleId would let an editor of one course
 *    reorder another's lessons);
 *  - the ids must be unique;
 *  - they must be exactly the module's current lessons — a partial list would
 *    leave duplicate or gapped order_index values, i.e. an ambiguous
 *    curriculum.
 */
export async function reorderLessonsAction(
  courseId: string,
  moduleId: string,
  ids: string[],
): Promise<ContentFormState> {
  await requireCourseEditor(courseId);
  const t = await getTranslations("Studio");

  const parsed = reorderSchema.safeParse({ ids });
  if (!parsed.success) return { error: t("reorderFailed") };

  const parentModule = await modulesRepository.findById(moduleId);
  if (!parentModule || parentModule.courseId !== courseId) {
    return { error: t("reorderFailed") };
  }

  const current = await lessonsRepository.listByModule(moduleId);
  const currentIds = new Set(current.map((l) => l.id));
  const nextIds = new Set(parsed.data.ids);
  const sameSet =
    nextIds.size === parsed.data.ids.length &&
    nextIds.size === currentIds.size &&
    [...nextIds].every((id) => currentIds.has(id));
  if (!sameSet) {
    // Someone else added or removed a lesson while this list was open; the
    // client refetches on failure rather than writing a stale ordering.
    return { error: t("reorderStale") };
  }

  await lessonsRepository.reorder(moduleId, parsed.data.ids);
  revalidateCourse(courseId);
  return {};
}

export async function deleteLessonAction(
  courseId: string,
  lessonId: string,
): Promise<void> {
  await requireCourseEditor(courseId);
  await lessonsRepository.softDelete(lessonId);
  revalidateCourse(courseId);
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { lessonProgressRepository } from "@/lib/db/repositories/lesson-progress";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { notesRepository } from "@/lib/db/repositories/notes";

/**
 * Student learning actions. Enrollment is dev-only here (free enroll) — Phase 5
 * replaces `devEnrollAction` with creation on a verified Click/Payme callback,
 * reusing the same enrollmentsRepository.enroll().
 */

/** Resolve the module → its course, to scope a lesson action to enrollment. */
async function courseIdForLesson(lessonId: string): Promise<string | null> {
  const lesson = await lessonsRepository.findById(lessonId);
  if (!lesson) return null;
  const { modulesRepository } = await import(
    "@/lib/db/repositories/modules"
  );
  const mod = await modulesRepository.findById(lesson.moduleId);
  return mod?.courseId ?? null;
}

async function assertLessonEnrollment(userId: string, lessonId: string) {
  const courseId = await courseIdForLesson(lessonId);
  if (!courseId) throw new Error("Lesson not found");
  const enrolled = await enrollmentsRepository.isActive(userId, courseId);
  return { courseId, enrolled };
}

// ── Enrollment (DEV ONLY — replaced by payments in Phase 5) ───────────────────

export async function devEnrollAction(courseId: string): Promise<void> {
  const user = await requireUser();
  const course = await coursesRepository.findById(courseId);
  if (!course || course.status !== "published") {
    throw new Error("Course not available");
  }
  // TODO(phase-5): create the enrollment from a verified payment callback
  // instead of here. Until then this is a free, dev-only enroll.
  await enrollmentsRepository.enroll({
    userId: user.id,
    courseId,
    accessDurationDays: course.accessDurationDays,
  });
  revalidatePath(`/courses/${course.slug}`);
  return redirectLocalized(`/learn/${courseId}`);
}

// ── Progress ─────────────────────────────────────────────────────────────────

const completeSchema = z.object({
  lessonId: z.uuid(),
  selfAssessment: z.coerce.number().int().min(1).max(5).optional(),
});

export async function completeLessonAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = completeSchema.safeParse({
    lessonId: formData.get("lessonId"),
    selfAssessment: formData.get("selfAssessment") || undefined,
  });
  if (!parsed.success) return { ok: false };

  const { enrolled, courseId } = await assertLessonEnrollment(
    user.id,
    parsed.data.lessonId,
  );
  if (!enrolled) return { ok: false };

  await lessonProgressRepository.markComplete(
    user.id,
    parsed.data.lessonId,
    parsed.data.selfAssessment ?? null,
  );
  revalidatePath(`/learn/${courseId}/${parsed.data.lessonId}`);
  return { ok: true };
}

// ── Notes (B7 + B8 merged: a note may pin a video timestamp) ─────────────────

/** "90" → 90, "1:30" → 90, "01:30:05" → 5405; null for empty/invalid. */
function parseTimestamp(raw: string): number | null {
  if (!raw) return null;
  if (!/^\d{1,4}(:[0-5]?\d){0,2}$/.test(raw)) return null;
  return raw
    .split(":")
    .reduce((total, part) => total * 60 + parseInt(part, 10), 0);
}

export async function addNoteAction(
  lessonId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false };
  const timestampSeconds = parseTimestamp(
    String(formData.get("timestamp") ?? "").trim(),
  );
  const { enrolled, courseId } = await assertLessonEnrollment(user.id, lessonId);
  if (!enrolled) return { ok: false };
  await notesRepository.create(user.id, lessonId, body, timestampSeconds);
  revalidatePath(`/learn/${courseId}/${lessonId}`);
  return { ok: true };
}

export async function deleteNoteAction(
  lessonId: string,
  noteId: string,
): Promise<void> {
  const user = await requireUser();
  const { courseId } = await assertLessonEnrollment(user.id, lessonId);
  await notesRepository.remove(user.id, noteId);
  revalidatePath(`/learn/${courseId}/${lessonId}`);
}

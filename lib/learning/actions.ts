"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { remindFinalExamIfDue } from "./exam-reminder";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { lessonProgressRepository } from "@/lib/db/repositories/lesson-progress";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { notesRepository } from "@/lib/db/repositories/notes";
import { lessonVideosRepository } from "@/lib/db/repositories/lesson-videos";

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

/**
 * The id of `videoId` when it is one of this lesson's parts, else null. Every
 * part id a client sends is checked here: a part of another lesson must never
 * be recorded as opened, or pinned to a note.
 */
async function partOfLesson(lessonId: string, videoId: unknown): Promise<string | null> {
  if (typeof videoId !== "string" || !z.uuid().safeParse(videoId).success) return null;
  const part = await lessonVideosRepository.findById(videoId);
  return part && part.lessonId === lessonId ? part.id : null;
}

/**
 * The student opened one part of a multi-part lesson: remember it (resume to
 * that part next time) and count it towards completion.
 */
export async function markVideoOpenedAction(
  lessonId: string,
  videoId: string,
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const part = await partOfLesson(lessonId, videoId);
  if (!part) return { ok: false };
  const { enrolled } = await assertLessonEnrollment(user.id, lessonId);
  if (!enrolled) return { ok: false };
  await lessonProgressRepository.markVideoOpened(user.id, lessonId, part);
  return { ok: true };
}

// ── Enrollment (DEV ONLY — replaced by payments in Phase 5) ───────────────────

export async function devEnrollAction(courseId: string): Promise<void> {
  // A free enrol is a development convenience and nothing else. It used to be
  // reachable on the live site whenever no payment provider was configured —
  // which is to say, on the live site.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Free enrollment is not available in production");
  }
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
  // The part on screen when "Mark complete" was pressed (counts as opened).
  videoId: z.uuid().optional(),
  selfAssessment: z.coerce.number().int().min(1).max(5).optional(),
});

export async function completeLessonAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; partsLeft?: boolean }> {
  const user = await requireUser();
  const parsed = completeSchema.safeParse({
    lessonId: formData.get("lessonId"),
    selfAssessment: formData.get("selfAssessment") || undefined,
    videoId: formData.get("videoId") || undefined,
  });
  if (!parsed.success) return { ok: false };

  const { enrolled, courseId } = await assertLessonEnrollment(
    user.id,
    parsed.data.lessonId,
  );
  if (!enrolled) return { ok: false };

  // A lesson in parts is complete only once every part has been opened —
  // enforced here too, not just by the disabled button.
  const parts = await lessonVideosRepository.listByLesson(parsed.data.lessonId);
  if (parts.length > 1) {
    const current = await partOfLesson(parsed.data.lessonId, parsed.data.videoId);
    if (current) {
      await lessonProgressRepository.markVideoOpened(user.id, parsed.data.lessonId, current);
    }
    const progress = await lessonProgressRepository.forLesson(user.id, parsed.data.lessonId);
    const opened = new Set(progress?.openedVideoIds ?? []);
    if (!parts.every((p) => opened.has(p.id))) return { ok: false, partsLeft: true };
  }

  await lessonProgressRepository.markComplete(
    user.id,
    parsed.data.lessonId,
    parsed.data.selfAssessment ?? null,
  );
  // If that was the last lesson and a final exam is waiting, say so by SMS.
  await remindFinalExamIfDue(user.id, courseId);
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
  // A timestamp means a moment in one part's video; pin the note to it.
  const videoId = timestampSeconds != null ? await partOfLesson(lessonId, formData.get("videoId")) : null;
  await notesRepository.create(user.id, lessonId, body, timestampSeconds, videoId);
  revalidatePath(`/learn/${courseId}/${lessonId}`);
  return { ok: true };
}

/**
 * Save the current moment of the video as a bookmark — a note pinned to that
 * time, with a default label the student can edit or delete later.
 */
export async function bookmarkAction(
  lessonId: string,
  seconds: number,
  videoId?: string | null,
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const t = Number.isFinite(seconds) && seconds >= 0 ? Math.min(Math.floor(seconds), 86_400) : 0;
  const { enrolled, courseId } = await assertLessonEnrollment(user.id, lessonId);
  if (!enrolled) return { ok: false };
  const tr = await getTranslations("Player");
  await notesRepository.create(user.id, lessonId, tr("bookmarkBody"), t, await partOfLesson(lessonId, videoId));
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

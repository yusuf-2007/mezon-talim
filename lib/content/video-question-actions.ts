"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCourseEditor } from "./access";
import { videoQuestionsRepository } from "@/lib/db/repositories/video-questions";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { syncVideoMoments } from "@/lib/video";
import type { LocalizedText } from "@/lib/db/schema";

/**
 * Studio authoring for in-video popup questions. Ownership is enforced via
 * requireCourseEditor on the lesson's course (resolved server-side — the
 * caller-supplied courseId is never trusted for authorization).
 */

export type VideoQuestionFormState = {
  error?: string;
  ok?: boolean;
};

/** "1:30" / "01:02:03" / "95" → seconds; null when malformed. */
function parseTimestamp(raw: string): number | null {
  if (!/^\d{1,4}(:[0-5]?\d){0,2}$/.test(raw)) return null;
  return raw.split(":").reduce((total, part) => total * 60 + parseInt(part, 10), 0);
}

const schema = z.object({
  timestamp: z.string().trim().min(1),
  promptUz: z.string().trim().min(1).max(500),
  promptRu: z.string().trim().max(500).optional(),
  correctIndex: z.coerce.number().int().min(0).max(3),
});

async function requireLessonEditor(lessonId: string) {
  if (!z.string().uuid().safeParse(lessonId).success) return null;
  const lesson = await lessonsRepository.findById(lessonId);
  if (!lesson) return null;
  const mod = await modulesRepository.findById(lesson.moduleId);
  if (!mod) return null;
  await requireCourseEditor(mod.courseId);
  return { lesson, courseId: mod.courseId };
}

/**
 * Mirror the lesson's question timestamps onto the Bunny video as native
 * "moments", so dots appear inside the embed player's own seek bar. Best
 * effort: authoring succeeds even when Bunny is unreachable/unconfigured.
 */
async function syncMomentsForLesson(
  lessonId: string,
  bunnyVideoId: string | null,
): Promise<void> {
  if (!bunnyVideoId) return;
  try {
    const questions = await videoQuestionsRepository.listForLesson(lessonId);
    await syncVideoMoments(
      bunnyVideoId,
      questions.map((q) => ({ label: "Savol", timestamp: q.timestampSeconds })),
    );
  } catch (err) {
    console.error("moments sync skipped:", err);
  }
}

export async function createVideoQuestionAction(
  lessonId: string,
  _prev: VideoQuestionFormState,
  formData: FormData,
): Promise<VideoQuestionFormState> {
  const ctx = await requireLessonEditor(lessonId);
  if (!ctx) return { error: "not_found" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const timestampSeconds = parseTimestamp(parsed.data.timestamp);
  if (timestampSeconds == null) return { error: "invalid_time" };
  // A timestamp past the video's end would author a question that never fires.
  if (
    ctx.lesson.durationSeconds != null &&
    ctx.lesson.durationSeconds > 0 &&
    timestampSeconds > ctx.lesson.durationSeconds
  ) {
    return { error: "invalid_time" };
  }

  // Options: 2–4 filled uz labels (ru optional per option). Empty rows are
  // dropped, so the marked correct row must be remapped to its compacted
  // position — and must itself be a filled row.
  const rows: { option: LocalizedText; formIndex: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const uz = String(formData.get(`option${i}Uz`) ?? "").trim();
    const ru = String(formData.get(`option${i}Ru`) ?? "").trim();
    if (!uz) continue;
    rows.push({ option: ru ? { uz, ru } : { uz }, formIndex: i });
  }
  if (rows.length < 2) return { error: "need_options" };
  const correctIndex = rows.findIndex(
    (r) => r.formIndex === parsed.data.correctIndex,
  );
  if (correctIndex === -1) return { error: "invalid" };

  await videoQuestionsRepository.create({
    lessonId,
    timestampSeconds,
    prompt: parsed.data.promptRu
      ? { uz: parsed.data.promptUz, ru: parsed.data.promptRu }
      : { uz: parsed.data.promptUz },
    options: rows.map((r) => r.option),
    correctIndex,
  });

  await syncMomentsForLesson(lessonId, ctx.lesson.bunnyVideoId);
  revalidatePath(`/studio/courses/${ctx.courseId}`);
  return { ok: true };
}

export async function deleteVideoQuestionAction(
  questionId: string,
): Promise<void> {
  if (!z.string().uuid().safeParse(questionId).success) return;
  const question = await videoQuestionsRepository.findById(questionId);
  if (!question) return;
  const ctx = await requireLessonEditor(question.lessonId);
  if (!ctx) return;
  await videoQuestionsRepository.remove(questionId);
  await syncMomentsForLesson(question.lessonId, ctx.lesson.bunnyVideoId);
  revalidatePath(`/studio/courses/${ctx.courseId}`);
}

"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { videoQuestionsRepository } from "@/lib/db/repositories/video-questions";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { getCurriculum, locateLesson } from "@/lib/learning/curriculum";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Student side of in-video questions: submit an answer, get the verdict. The
 * correct index is only ever revealed here, after an answer is committed —
 * the player payload never contains it.
 */

export type VideoAnswerResult =
  | { ok: true; correct: boolean; correctIndex: number }
  | { ok: false };

export async function answerVideoQuestionAction(
  questionId: string,
  selectedIndex: number,
): Promise<VideoAnswerResult> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(questionId).success) return { ok: false };
  if (!z.number().int().min(0).max(3).safeParse(selectedIndex).success) {
    return { ok: false };
  }
  if (!(await checkRateLimit(`vq:answer:${user.id}`, 60, 5 * 60_000)).ok) {
    return { ok: false };
  }

  const question = await videoQuestionsRepository.findById(questionId);
  if (!question || selectedIndex >= question.options.length) return { ok: false };

  // Same access rule as watching the lesson: instructors pass, students need
  // the lesson to actually be accessible to them (enrolled + unlocked, or preview).
  const lesson = await lessonsRepository.findById(question.lessonId);
  if (!lesson) return { ok: false };
  const mod = await modulesRepository.findById(lesson.moduleId);
  const course = mod ? await coursesRepository.findById(mod.courseId) : null;
  if (!course) return { ok: false };

  const isInstructor =
    user.role === "super_admin" ||
    (user.role === "teacher" && course.createdBy === user.id);
  if (!isInstructor) {
    const curriculum = await getCurriculum(course.id, user.id);
    const located = locateLesson(curriculum, question.lessonId);
    if (!located.lesson?.accessible) return { ok: false };
  }

  const correct = selectedIndex === question.correctIndex;
  await videoQuestionsRepository.answer({
    questionId,
    userId: user.id,
    selectedIndex,
    isCorrect: correct,
  });

  return { ok: true, correct, correctIndex: question.correctIndex };
}

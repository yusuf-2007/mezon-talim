"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { messagesRepository } from "@/lib/db/repositories/messages";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { getCurriculum, locateLesson } from "@/lib/learning/curriculum";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Private student→instructor messaging. A thread belongs to one student on one
 * lesson. Students may write only in their OWN thread (and must be enrolled);
 * the instructor side — the course's owning teacher or a super admin — may
 * reply in any existing thread but cannot start one (students initiate).
 */

const bodySchema = z.string().trim().min(1).max(2000);
const uuidSchema = z.string().uuid();

export async function sendAuthorMessageAction(
  lessonId: string,
  threadStudentId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean }> {
  const user = await requireUser();

  if (!uuidSchema.safeParse(lessonId).success) return { ok: false };
  if (!uuidSchema.safeParse(threadStudentId).success) return { ok: false };
  const parsedBody = bodySchema.safeParse(formData.get("body"));
  if (!parsedBody.success) return { ok: false };

  if (!checkRateLimit(`msg:add:${user.id}`, 10, 5 * 60_000).ok) {
    return { ok: false };
  }

  const lesson = await lessonsRepository.findById(lessonId);
  if (!lesson) return { ok: false };
  const mod = await modulesRepository.findById(lesson.moduleId);
  const course = mod ? await coursesRepository.findById(mod.courseId) : null;
  if (!course) return { ok: false };

  const isInstructor =
    user.role === "super_admin" ||
    (user.role === "teacher" && course.createdBy === user.id);

  if (isInstructor) {
    // Reply-only: an instructor writes into a student's existing thread.
    const exists = await messagesRepository.hasThread(lessonId, threadStudentId);
    if (!exists) return { ok: false };
  } else {
    // A student writes only in their own thread, only while enrolled, and only
    // on lessons they've actually reached (B2 sequential unlock — the action
    // must enforce this itself; server actions are directly callable).
    if (threadStudentId !== user.id) return { ok: false };
    const enrolled = await enrollmentsRepository.isActive(user.id, course.id);
    if (!enrolled) return { ok: false };
    const curriculum = await getCurriculum(course.id, user.id);
    const located = locateLesson(curriculum, lessonId);
    if (!located.lesson?.accessible) return { ok: false };
  }

  await messagesRepository.create({
    lessonId,
    studentId: threadStudentId,
    senderId: user.id,
    body: parsedBody.data,
  });
  revalidatePath(`/learn/${course.id}/${lessonId}`);
  return { ok: true };
}

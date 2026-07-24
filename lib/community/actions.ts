"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { commentsRepository } from "@/lib/db/repositories/comments";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { fireInAppNotification } from "@/lib/notifications/inapp";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Lesson discussion actions (B19). Posting requires an active enrollment —
 * except teachers/super admins, who may reply as instructors on any lesson.
 * Moderation: authors delete their own comments; teachers/super admins can
 * delete any (replies cascade).
 */

const bodySchema = z.string().trim().min(1).max(2000);

async function courseIdForLesson(lessonId: string): Promise<string | null> {
  const lesson = await lessonsRepository.findById(lessonId);
  if (!lesson) return null;
  const mod = await modulesRepository.findById(lesson.moduleId);
  return mod?.courseId ?? null;
}

export async function addCommentAction(
  lessonId: string,
  parentId: string | null,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean }> {
  const user = await requireUser();

  const parsedBody = bodySchema.safeParse(formData.get("body"));
  if (!parsedBody.success) return { ok: false };

  // Modest per-user cap to blunt spam; generous enough for real discussion.
  if (!checkRateLimit(`comment:add:${user.id}`, 10, 5 * 60_000).ok) {
    return { ok: false };
  }

  const courseId = await courseIdForLesson(lessonId);
  if (!courseId) return { ok: false };

  const isInstructor = user.role === "teacher" || user.role === "super_admin";
  if (!isInstructor) {
    const enrolled = await enrollmentsRepository.isActive(user.id, courseId);
    if (!enrolled) return { ok: false };
  }

  // Replying: the parent must be a comment on this same lesson. Replying to a
  // reply flattens into its top-level thread (YouTube semantics).
  let effectiveParentId: string | null = null;
  if (parentId) {
    const parent = await commentsRepository.findById(parentId);
    if (!parent || parent.lessonId !== lessonId) return { ok: false };
    effectiveParentId = parent.parentId ?? parent.id;
  }

  const created = await commentsRepository.create({
    userId: user.id,
    lessonId,
    body: parsedBody.data,
    parentId: effectiveParentId,
  });

  // Bell notifications: a reply pings every other participant of the flattened
  // thread (root author + reply authors — so answering a reply reaches the
  // person being answered, not just the thread owner); a new top-level comment
  // pings the course author. Best-effort, self-notify filtered inside.
  if (effectiveParentId) {
    const participants = await commentsRepository.threadParticipants(
      effectiveParentId,
    );
    for (const recipientId of participants) {
      await fireInAppNotification({
        userId: recipientId,
        actorUserId: user.id,
        type: "comment_reply",
        courseId,
        lessonId,
        body: parsedBody.data,
        sourceCommentId: created?.id,
      });
    }
  } else {
    const course = await coursesRepository.findById(courseId);
    await fireInAppNotification({
      userId: course?.createdBy,
      actorUserId: user.id,
      type: "lesson_comment",
      courseId,
      lessonId,
      body: parsedBody.data,
      sourceCommentId: created?.id,
    });
  }

  revalidatePath(`/learn/${courseId}/${lessonId}`);
  revalidatePath("/admin/messages");
  return { ok: true };
}

export async function deleteCommentAction(
  lessonId: string,
  commentId: string,
): Promise<void> {
  const user = await requireUser();
  const comment = await commentsRepository.findById(commentId);
  if (!comment || comment.lessonId !== lessonId) return;

  const isModerator = user.role === "teacher" || user.role === "super_admin";
  if (comment.userId !== user.id && !isModerator) return;

  await commentsRepository.remove(commentId);
  const courseId = await courseIdForLesson(lessonId);
  if (courseId) revalidatePath(`/learn/${courseId}/${lessonId}`);
  revalidatePath("/admin/messages");
}

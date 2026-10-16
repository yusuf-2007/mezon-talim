import "server-only";
import { z } from "zod";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { lessonProgressRepository } from "@/lib/db/repositories/lesson-progress";
import { lessonVideosRepository } from "@/lib/db/repositories/lesson-videos";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { modulesRepository } from "@/lib/db/repositories/modules";

/** Below this, "resume" is not worth it: start from the beginning. */
const MIN_RESUME_SECONDS = 5;
/** This close to the end counts as watched: start over next time. */
const END_MARGIN_SECONDS = 15;

export const positionSchema = z.object({
  lessonId: z.uuid(),
  videoId: z.uuid(),
  seconds: z.number().finite().min(0).max(24 * 60 * 60),
});

/**
 * Save where an enrolled student is in a lesson's video. The part must belong
 * to the lesson, and only enrolled students have progress to save (preview
 * viewers and instructors just watch). Returns false when nothing was saved.
 */
export async function saveLessonPosition(
  userId: string,
  input: z.infer<typeof positionSchema>,
): Promise<boolean> {
  const [part, lesson] = await Promise.all([
    lessonVideosRepository.findById(input.videoId),
    lessonsRepository.findById(input.lessonId),
  ]);
  if (!part || part.lessonId !== input.lessonId || !lesson) return false;
  const parentModule = await modulesRepository.findById(lesson.moduleId);
  if (!parentModule) return false;
  if (!(await enrollmentsRepository.isActive(userId, parentModule.courseId))) return false;
  await lessonProgressRepository.savePosition(
    userId,
    input.lessonId,
    input.videoId,
    Math.floor(input.seconds),
  );
  return true;
}

/**
 * Where the video on screen should start: the saved playhead, when it was
 * saved on this part, is past the first few seconds, and is not at the end.
 */
export function resumeSeconds(
  progress: { lastVideoId: string | null; lastPositionSeconds: number } | null,
  part: { id: string; durationSeconds: number | null } | null,
): number {
  if (!progress || !part || progress.lastVideoId !== part.id) return 0;
  const at = progress.lastPositionSeconds;
  if (at < MIN_RESUME_SECONDS) return 0;
  if (part.durationSeconds && at >= part.durationSeconds - END_MARGIN_SECONDS) return 0;
  return at;
}

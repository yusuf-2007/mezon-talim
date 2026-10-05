import "server-only";
import type { SessionUser } from "@/lib/auth";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { getCurriculum, locateLesson } from "./curriculum";

type CourseRow = NonNullable<Awaited<ReturnType<typeof coursesRepository.findById>>>;
type LessonRow = NonNullable<Awaited<ReturnType<typeof lessonsRepository.findById>>>;

/**
 * The course's instructor: any super admin, or the teacher who created it.
 * Instructors bypass the sequential lock — they must be able to open every one
 * of their lessons to check content and answer private questions. This is the
 * ONE definition; the lesson page and the attachment routes both use it.
 */
export function isCourseInstructor(
  user: Pick<SessionUser, "id" | "role">,
  course: { createdBy: string | null },
): boolean {
  return user.role === "super_admin" || (user.role === "teacher" && course.createdBy === user.id);
}

export type LessonAccess = {
  lesson: LessonRow;
  course: CourseRow;
  /** Same rule as the lesson page: accessible in the curriculum, or instructor. */
  canView: boolean;
  isInstructor: boolean;
};

/**
 * May this user open this lesson? Mirrors the lesson page exactly: the lesson
 * is `accessible` in the viewer's curriculum (a preview, or enrolled and
 * sequentially unlocked — B1/B2), or the viewer is the course's instructor.
 *
 * Returns null when the lesson (or its course) is missing or soft-deleted, so
 * callers can answer 404 rather than 403.
 */
export async function resolveLessonAccess(
  user: Pick<SessionUser, "id" | "role">,
  lessonId: string,
): Promise<LessonAccess | null> {
  const lesson = await lessonsRepository.findById(lessonId);
  if (!lesson) return null;
  const parentModule = await modulesRepository.findById(lesson.moduleId);
  if (!parentModule) return null;
  const course = await coursesRepository.findById(parentModule.courseId);
  if (!course) return null;

  const isInstructor = isCourseInstructor(user, course);
  if (isInstructor) return { lesson, course, canView: true, isInstructor };

  const curriculum = await getCurriculum(course.id, user.id);
  const located = locateLesson(curriculum, lessonId).lesson;
  return { lesson, course, canView: Boolean(located?.accessible), isInstructor };
}

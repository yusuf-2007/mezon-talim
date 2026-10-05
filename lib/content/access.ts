import "server-only";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { modulesRepository } from "@/lib/db/repositories/modules";

/**
 * Studio authorization. Teachers may author their own courses; super_admins may
 * author any. The (studio) layout already gates the area by role — these helpers
 * add per-resource ownership checks on top.
 */
export async function requireCourseEditor(courseId: string) {
  const user = await requireRole("teacher", "super_admin");
  const course = await coursesRepository.findById(courseId);
  if (!course) notFound();
  if (user.role !== "super_admin" && course.createdBy !== user.id) {
    return redirectLocalized("/forbidden");
  }
  return { user, course };
}

/**
 * Ownership of the ids an action is handed. `requireCourseEditor` authorizes
 * one course; server actions are public endpoints that can be called with any
 * arguments, so a module or lesson id must be checked against that course too.
 * Otherwise an editor of course A could add, edit or delete content in course B.
 *
 * "missing" (the row does not exist, or the lesson is soft-deleted) is kept
 * apart from "other" (it exists in another course), so a repeated delete can
 * stay a harmless no-op while a cross-course id is refused.
 */
export type Ownership = "ok" | "missing" | "other";

export async function moduleOwnership(moduleId: string, courseId: string): Promise<Ownership> {
  const parentModule = await modulesRepository.findById(moduleId);
  if (!parentModule) return "missing";
  return parentModule.courseId === courseId ? "ok" : "other";
}

export async function lessonOwnership(lessonId: string, courseId: string): Promise<Ownership> {
  const lesson = await lessonsRepository.findById(lessonId);
  if (!lesson) return "missing";
  const parent = await moduleOwnership(lesson.moduleId, courseId);
  return parent === "missing" ? "other" : parent;
}

/** 404 unless the module exists and belongs to the course. */
export async function requireModuleInCourse(moduleId: string, courseId: string): Promise<void> {
  if ((await moduleOwnership(moduleId, courseId)) !== "ok") notFound();
}

/** 404 unless the lesson exists, is not deleted, and belongs to the course. */
export async function requireLessonInCourse(lessonId: string, courseId: string): Promise<void> {
  if ((await lessonOwnership(lessonId, courseId)) !== "ok") notFound();
}

/** Courses visible in a user's Studio: own for teachers, all for super_admin. */
export async function listStudioCourses(
  userId: string,
  role: "teacher" | "super_admin" | "student" | "accountant",
) {
  return role === "super_admin"
    ? coursesRepository.listAll()
    : coursesRepository.listByOwner(userId);
}

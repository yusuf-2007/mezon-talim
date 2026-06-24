import "server-only";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { coursesRepository } from "@/lib/db/repositories/courses";

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

/** Courses visible in a user's Studio: own for teachers, all for super_admin. */
export async function listStudioCourses(
  userId: string,
  role: "teacher" | "super_admin" | "student" | "accountant",
) {
  return role === "super_admin"
    ? coursesRepository.listAll()
    : coursesRepository.listByOwner(userId);
}

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { auditRepository } from "@/lib/db/repositories/audit";
import type { Role } from "@/lib/auth/types";

const ROLES: Role[] = ["student", "teacher", "accountant", "super_admin"];
const STATUSES = ["draft", "published", "archived"] as const;
type CourseStatus = (typeof STATUSES)[number];

/** Change a user's role (super_admin only). Audited; self-demotion blocked. */
export async function setUserRoleAction(
  userId: string,
  role: string,
): Promise<void> {
  const actor = await requireRole("super_admin");
  if (!ROLES.includes(role as Role)) throw new Error("Invalid role");
  // Guard: don't let an admin strip their own super_admin (lockout risk).
  if (actor.id === userId && role !== "super_admin") {
    throw new Error("Cannot change your own super_admin role");
  }
  const before = await usersRepository.findById(userId);
  if (!before) throw new Error("User not found");

  await usersRepository.setRole(userId, role as Role);
  await auditRepository.record({
    actorUserId: actor.id,
    action: "user.role_change",
    entityType: "user",
    entityId: userId,
    meta: { from: before.role, to: role },
  });
  revalidatePath("/admin/users");
}

/** Change a course's status from the admin area (super_admin only). Audited. */
export async function setCourseStatusAdminAction(
  courseId: string,
  status: string,
): Promise<void> {
  const actor = await requireRole("super_admin");
  if (!STATUSES.includes(status as CourseStatus)) {
    throw new Error("Invalid status");
  }
  const before = await coursesRepository.findById(courseId);
  if (!before) throw new Error("Course not found");

  await coursesRepository.setStatus(courseId, status as CourseStatus);
  await auditRepository.record({
    actorUserId: actor.id,
    action: "course.status_change",
    entityType: "course",
    entityId: courseId,
    meta: { from: before.status, to: status },
  });
  revalidatePath("/admin/courses");
}

/** Soft-delete a course from the admin courses list (super_admin only). Audited. */
export async function deleteCourseAdminAction(courseId: string): Promise<void> {
  const actor = await requireRole("super_admin");
  const before = await coursesRepository.findById(courseId);
  if (!before) return;
  await coursesRepository.softDelete(courseId);
  await auditRepository.record({
    actorUserId: actor.id,
    action: "course.delete",
    entityType: "course",
    entityId: courseId,
    meta: { slug: before.slug },
  });
  revalidatePath("/admin/courses");
}

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { lessonProgressRepository } from "@/lib/db/repositories/lesson-progress";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { auditRepository } from "@/lib/db/repositories/audit";
import { issueManual } from "@/lib/certificates/service";
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

// ── User detail: profile, enrollments, progress, certificates ───────────────

/** Update a user's editable profile (fullName, locale, role). super_admin. Audited. */
export async function updateUserProfileAction(
  userId: string,
  formData: FormData,
): Promise<void> {
  const actor = await requireRole("super_admin");
  const fullName = String(formData.get("fullName") ?? "").trim() || null;
  const localeRaw = String(formData.get("locale") ?? "uz");
  const locale = localeRaw === "ru" ? "ru" : "uz";
  const roleRaw = String(formData.get("role") ?? "");
  const role = ROLES.includes(roleRaw as Role) ? (roleRaw as Role) : undefined;

  if (actor.id === userId && role && role !== "super_admin") {
    throw new Error("Cannot change your own super_admin role");
  }
  await usersRepository.updateProfile(userId, { fullName, locale, role });
  await auditRepository.record({
    actorUserId: actor.id,
    action: "user.profile_update",
    entityType: "user",
    entityId: userId,
    meta: { fullName, locale, role },
  });
  revalidatePath(`/admin/users/${userId}`);
}

/** Enroll a user in a course from the admin (super_admin). Audited. */
export async function adminEnrollAction(
  userId: string,
  courseId: string,
): Promise<void> {
  const actor = await requireRole("super_admin");
  const course = await coursesRepository.findById(courseId);
  if (!course) throw new Error("Course not found");
  await enrollmentsRepository.enroll({
    userId,
    courseId,
    accessDurationDays: course.accessDurationDays,
  });
  await auditRepository.record({
    actorUserId: actor.id,
    action: "enrollment.create",
    entityType: "enrollment",
    entityId: `${userId}:${courseId}`,
    meta: { courseSlug: course.slug },
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/enrollments");
}

/** Remove a user's enrollment (super_admin). Audited. */
export async function removeEnrollmentAction(
  userId: string,
  courseId: string,
): Promise<void> {
  const actor = await requireRole("super_admin");
  const removed = await enrollmentsRepository.removeByUserCourse(userId, courseId);
  if (removed) {
    await auditRepository.record({
      actorUserId: actor.id,
      action: "enrollment.remove",
      entityType: "enrollment",
      entityId: `${userId}:${courseId}`,
    });
  }
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/enrollments");
}

/** Reset a user's lesson progress for a course (super_admin). Audited. */
export async function resetProgressAction(
  userId: string,
  courseId: string,
): Promise<void> {
  const actor = await requireRole("super_admin");
  const lessonRows = await lessonsRepository.listByCourse(courseId);
  await lessonProgressRepository.resetForLessons(
    userId,
    lessonRows.map((r) => r.lesson.id),
  );
  await auditRepository.record({
    actorUserId: actor.id,
    action: "progress.reset",
    entityType: "enrollment",
    entityId: `${userId}:${courseId}`,
  });
  revalidatePath(`/admin/users/${userId}`);
}

/** Manually issue a certificate (admin override of the exam-pass gate). Audited. */
export async function issueCertificateAction(
  userId: string,
  courseId: string,
): Promise<void> {
  const actor = await requireRole("super_admin");
  const cert = await issueManual(userId, courseId);
  await auditRepository.record({
    actorUserId: actor.id,
    action: "certificate.issue_manual",
    entityType: "certificate",
    entityId: cert?.id ?? `${userId}:${courseId}`,
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/certificates");
}

/** Revoke a certificate (super_admin). Audited. */
export async function revokeCertificateAction(certId: string): Promise<void> {
  const actor = await requireRole("super_admin");
  const cert = await certificatesRepository.findById(certId);
  if (!cert) return;
  await certificatesRepository.revoke(certId);
  await auditRepository.record({
    actorUserId: actor.id,
    action: "certificate.revoke",
    entityType: "certificate",
    entityId: certId,
  });
  revalidatePath(`/admin/users/${cert.userId}`);
  revalidatePath("/admin/certificates");
}

/** Re-issue: revoke the old certificate and issue a fresh one. Audited. */
export async function reissueCertificateAction(certId: string): Promise<void> {
  const actor = await requireRole("super_admin");
  const cert = await certificatesRepository.findById(certId);
  if (!cert) return;
  await certificatesRepository.revoke(certId);
  const fresh = await issueManual(cert.userId, cert.courseId);
  await auditRepository.record({
    actorUserId: actor.id,
    action: "certificate.reissue",
    entityType: "certificate",
    entityId: fresh?.id ?? certId,
    meta: { revoked: certId },
  });
  revalidatePath(`/admin/users/${cert.userId}`);
  revalidatePath("/admin/certificates");
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

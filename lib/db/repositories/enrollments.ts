import "server-only";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "../client";
import { courses, enrollments } from "../schema";

/**
 * Enrollment repository. An enrollment is normally created on a verified `paid`
 * callback (Phase 5); Phase 4 also offers a dev-only free enroll. `expires_at`
 * is set from the course's access_duration_days. An enrollment counts as active
 * when status='active' and (expires_at is null or in the future).
 */
export const enrollmentsRepository = {
  async find(userId: string, courseId: string) {
    const [row] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, userId),
          eq(enrollments.courseId, courseId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /** True if the user has a non-expired active enrollment for the course. */
  async isActive(userId: string, courseId: string) {
    const [row] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, userId),
          eq(enrollments.courseId, courseId),
          eq(enrollments.status, "active"),
          or(isNull(enrollments.expiresAt), gt(enrollments.expiresAt, sql`now()`)),
        ),
      )
      .limit(1);
    return Boolean(row);
  },

  /** Active enrollments for a user, joined with their course (My Courses). */
  async listActiveWithCourse(userId: string) {
    return db
      .select({ enrollment: enrollments, course: courses })
      .from(enrollments)
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .where(
        and(
          eq(enrollments.userId, userId),
          eq(enrollments.status, "active"),
          isNull(courses.deletedAt),
        ),
      )
      .orderBy(desc(enrollments.startedAt));
  },

  /**
   * Create (or reactivate) an enrollment. Idempotent on (user, course) thanks to
   * the unique constraint — on conflict it re-activates and resets the window.
   */
  async enroll(input: {
    userId: string;
    courseId: string;
    accessDurationDays: number;
    sourcePaymentId?: string | null;
  }) {
    const expiresAt = sql`now() + (${input.accessDurationDays} || ' days')::interval`;
    const [row] = await db
      .insert(enrollments)
      .values({
        userId: input.userId,
        courseId: input.courseId,
        status: "active",
        sourcePaymentId: input.sourcePaymentId ?? null,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [enrollments.userId, enrollments.courseId],
        set: {
          status: "active",
          startedAt: sql`now()`,
          expiresAt,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return row;
  },
};

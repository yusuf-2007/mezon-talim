import "server-only";
import { and, asc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "../client";
import { courses, enrollments, glossaryTerms } from "../schema";

/**
 * Glossary / izohli lug'at (B9). Terms can be course-scoped or global
 * (course_id null); the player shows both for a given course.
 */
export const glossaryRepository = {
  /**
   * Every term the student can see, with the course each one belongs to.
   *
   * The dashboard glossary is a library rather than a lesson aside, so it needs
   * the scope — global terms apply everywhere, course terms only inside their
   * course — and it needs terms from courses the student is not enrolled in to
   * stay out of it.
   */
  async listForUser(userId: string) {
    return db
      .select({
        id: glossaryTerms.id,
        term: glossaryTerms.term,
        definition: glossaryTerms.definition,
        courseId: glossaryTerms.courseId,
        courseTitle: courses.title,
      })
      .from(glossaryTerms)
      .leftJoin(courses, eq(courses.id, glossaryTerms.courseId))
      .leftJoin(
        enrollments,
        and(
          eq(enrollments.courseId, glossaryTerms.courseId),
          eq(enrollments.userId, userId),
          eq(enrollments.status, "active"),
        ),
      )
      .where(or(isNull(glossaryTerms.courseId), isNotNull(enrollments.id)))
      .orderBy(asc(glossaryTerms.term));
  },

  async listForCourse(courseId: string) {
    return db
      .select()
      .from(glossaryTerms)
      .where(
        or(
          eq(glossaryTerms.courseId, courseId),
          isNull(glossaryTerms.courseId),
        ),
      )
      .orderBy(asc(glossaryTerms.term));
  },
};

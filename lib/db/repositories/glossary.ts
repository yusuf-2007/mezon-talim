import "server-only";
import { asc, eq, isNull, or } from "drizzle-orm";
import { db } from "../client";
import { glossaryTerms } from "../schema";

/**
 * Glossary / izohli lug'at (B9). Terms can be course-scoped or global
 * (course_id null); the player shows both for a given course.
 */
export const glossaryRepository = {
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

import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../client";
import { courses } from "../schema";

/**
 * Course repository — the ONLY place course rows are read/written.
 * Components, route handlers, and server actions call these functions; they
 * never touch `db` or the ORM directly (CLAUDE.md §2.5, §8). This keeps the
 * storage engine swappable and the access surface auditable.
 *
 * This is the reference pattern; sibling repositories (users, enrollments,
 * lessons, payments, …) are added in their respective phases.
 */
export const coursesRepository = {
  /** Published, non-deleted courses for the public catalog. */
  async listPublished() {
    return db
      .select()
      .from(courses)
      .where(and(eq(courses.status, "published"), isNull(courses.deletedAt)));
  },

  async findBySlug(slug: string) {
    const [row] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.slug, slug), isNull(courses.deletedAt)))
      .limit(1);
    return row ?? null;
  },
};

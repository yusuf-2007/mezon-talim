import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { courses } from "../schema";
import type { LocalizedText } from "../schema";

/**
 * Course repository — the ONLY place course rows are read/written.
 * Components, route handlers, and server actions call these functions; they
 * never touch `db` or the ORM directly (CLAUDE.md §2.5, §8). This keeps the
 * storage engine swappable and the access surface auditable.
 */

export type CourseInsert = {
  slug: string;
  title: LocalizedText;
  summary?: LocalizedText | null;
  description?: LocalizedText | null;
  coverUrl?: string | null;
  priceTiyin: number;
  accessDurationDays: number;
  passThresholdPct: number;
  certificateEnabled: boolean;
  createdBy: string;
};

export type CourseUpdate = Partial<Omit<CourseInsert, "createdBy">>;

export const coursesRepository = {
  /** Published, non-deleted courses for the public catalog. */
  async listPublished() {
    return db
      .select()
      .from(courses)
      .where(and(eq(courses.status, "published"), isNull(courses.deletedAt)))
      .orderBy(desc(courses.createdAt));
  },

  /** All non-deleted courses (admin/super_admin Studio view). */
  async listAll() {
    return db
      .select()
      .from(courses)
      .where(isNull(courses.deletedAt))
      .orderBy(desc(courses.createdAt));
  },

  /** Non-deleted courses authored by a given user (teacher Studio view). */
  async listByOwner(userId: string) {
    return db
      .select()
      .from(courses)
      .where(and(eq(courses.createdBy, userId), isNull(courses.deletedAt)))
      .orderBy(desc(courses.createdAt));
  },

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), isNull(courses.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  async findBySlug(slug: string) {
    const [row] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.slug, slug), isNull(courses.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  async slugExists(slug: string, exceptId?: string) {
    const [row] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, slug))
      .limit(1);
    if (!row) return false;
    return exceptId ? row.id !== exceptId : true;
  },

  async create(input: CourseInsert) {
    const [row] = await db.insert(courses).values(input).returning();
    return row;
  },

  async update(id: string, patch: CourseUpdate) {
    const [row] = await db
      .update(courses)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(eq(courses.id, id))
      .returning();
    return row;
  },

  async setStatus(id: string, status: "draft" | "published" | "archived") {
    const [row] = await db
      .update(courses)
      .set({ status, updatedAt: sql`now()` })
      .where(eq(courses.id, id))
      .returning();
    return row;
  },

  /** Soft delete (CLAUDE.md: hard-delete only via admin). */
  async softDelete(id: string) {
    await db
      .update(courses)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(courses.id, id));
  },
};

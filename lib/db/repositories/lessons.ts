import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { lessons, modules } from "../schema";
import type { LocalizedText } from "../schema";

export type LessonInsert = {
  moduleId: string;
  title: LocalizedText;
  body?: LocalizedText | null;
  bunnyVideoId?: string | null;
  durationSeconds?: number | null;
  isPreview: boolean;
};

export type LessonUpdate = Partial<Omit<LessonInsert, "moduleId">>;

/** Lesson repository (module → lessons). Soft-deletable; ordered by order_index. */
export const lessonsRepository = {
  async listByModule(moduleId: string) {
    return db
      .select()
      .from(lessons)
      .where(and(eq(lessons.moduleId, moduleId), isNull(lessons.deletedAt)))
      .orderBy(asc(lessons.orderIndex));
  },

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(lessons)
      .where(and(eq(lessons.id, id), isNull(lessons.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** All non-deleted lessons of a course, ordered by module then lesson. */
  async listByCourse(courseId: string) {
    return db
      .select({ lesson: lessons, moduleOrder: modules.orderIndex })
      .from(lessons)
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .where(and(eq(modules.courseId, courseId), isNull(lessons.deletedAt)))
      .orderBy(asc(modules.orderIndex), asc(lessons.orderIndex));
  },

  /** Lesson count per course id (for catalog cards). */
  async countByCourses(courseIds: string[]) {
    if (courseIds.length === 0) return new Map<string, number>();
    const rows = await db
      .select({
        courseId: modules.courseId,
        count: sql<number>`count(*)::int`,
      })
      .from(lessons)
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .where(and(inArray(modules.courseId, courseIds), isNull(lessons.deletedAt)))
      .groupBy(modules.courseId);
    return new Map(rows.map((r) => [r.courseId, r.count]));
  },

  async create(input: LessonInsert) {
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${lessons.orderIndex}) + 1, 0)` })
      .from(lessons)
      .where(eq(lessons.moduleId, input.moduleId));
    const [row] = await db
      .insert(lessons)
      .values({ ...input, orderIndex: next })
      .returning();
    return row;
  },

  async update(id: string, patch: LessonUpdate) {
    const [row] = await db
      .update(lessons)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(eq(lessons.id, id))
      .returning();
    return row;
  },

  async softDelete(id: string) {
    await db
      .update(lessons)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(lessons.id, id));
  },

  async reorder(moduleId: string, ids: string[]) {
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx
          .update(lessons)
          .set({ orderIndex: i, updatedAt: sql`now()` })
          .where(and(eq(lessons.id, ids[i]), eq(lessons.moduleId, moduleId)));
      }
    });
  },
};

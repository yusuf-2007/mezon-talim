import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { lessons } from "../schema";
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

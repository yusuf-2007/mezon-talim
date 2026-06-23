import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { modules } from "../schema";
import type { LocalizedText } from "../schema";

/** Module repository (course → modules). Ordered by order_index. */
export const modulesRepository = {
  async listByCourse(courseId: string) {
    return db
      .select()
      .from(modules)
      .where(eq(modules.courseId, courseId))
      .orderBy(asc(modules.orderIndex));
  },

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(modules)
      .where(eq(modules.id, id))
      .limit(1);
    return row ?? null;
  },

  /** Append a module to the end of the course's ordering. */
  async create(courseId: string, title: LocalizedText) {
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${modules.orderIndex}) + 1, 0)` })
      .from(modules)
      .where(eq(modules.courseId, courseId));
    const [row] = await db
      .insert(modules)
      .values({ courseId, title, orderIndex: next })
      .returning();
    return row;
  },

  async update(id: string, title: LocalizedText) {
    const [row] = await db
      .update(modules)
      .set({ title, updatedAt: sql`now()` })
      .where(eq(modules.id, id))
      .returning();
    return row;
  },

  async remove(id: string) {
    await db.delete(modules).where(eq(modules.id, id));
  },

  /** Persist a new ordering. `ids` must all belong to `courseId`. */
  async reorder(courseId: string, ids: string[]) {
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx
          .update(modules)
          .set({ orderIndex: i, updatedAt: sql`now()` })
          .where(and(eq(modules.id, ids[i]), eq(modules.courseId, courseId)));
      }
    });
  },
};

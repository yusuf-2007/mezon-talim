import "server-only";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "../client";
import { lessonVideos, lessons } from "../schema";
import type { LocalizedText } from "../schema";

export type LessonVideoRow = typeof lessonVideos.$inferSelect;

/** One part as the lesson editor submits it; `id` is set for existing parts. */
export type LessonVideoInput = {
  id?: string;
  bunnyVideoId: string;
  durationSeconds: number | null;
  title: LocalizedText | null;
};

/**
 * Video parts of a lesson (Part 1, Part 2 …), in play order. The lesson's own
 * `duration_seconds` is kept as the total so catalog cards, the rail and the
 * dashboard keep reading one number.
 */
export const lessonVideosRepository = {
  async listByLesson(lessonId: string) {
    return db
      .select()
      .from(lessonVideos)
      .where(eq(lessonVideos.lessonId, lessonId))
      .orderBy(asc(lessonVideos.orderIndex));
  },

  /** Parts of many lessons at once (Studio module cards, curriculum). */
  async listByLessons(lessonIds: string[]) {
    const out = new Map<string, LessonVideoRow[]>();
    if (lessonIds.length === 0) return out;
    const rows = await db
      .select()
      .from(lessonVideos)
      .where(inArray(lessonVideos.lessonId, lessonIds))
      .orderBy(asc(lessonVideos.lessonId), asc(lessonVideos.orderIndex));
    for (const row of rows) {
      const list = out.get(row.lessonId) ?? [];
      list.push(row);
      out.set(row.lessonId, list);
    }
    return out;
  },

  async findById(id: string) {
    const [row] = await db.select().from(lessonVideos).where(eq(lessonVideos.id, id)).limit(1);
    return row ?? null;
  },

  /**
   * Make the lesson's parts exactly `parts`, in that order, and store the
   * total duration on the lesson — one transaction.
   *
   * Existing parts are updated IN PLACE (matched by id, and only ids that
   * already belong to this lesson), so notes, bookmarks and in-video questions
   * pinned to a part survive renames, re-ordering and video swaps. Parts left
   * out are deleted (their questions cascade; notes keep their text and lose
   * only the part pin).
   */
  async replaceForLesson(lessonId: string, parts: LessonVideoInput[]) {
    await db.transaction(async (tx) => {
      const current = await tx
        .select({ id: lessonVideos.id })
        .from(lessonVideos)
        .where(eq(lessonVideos.lessonId, lessonId));
      const owned = new Set(current.map((r) => r.id));
      const keep = parts.map((p) => p.id).filter((id): id is string => !!id && owned.has(id));

      await tx
        .delete(lessonVideos)
        .where(
          keep.length > 0
            ? and(eq(lessonVideos.lessonId, lessonId), notInArray(lessonVideos.id, keep))
            : eq(lessonVideos.lessonId, lessonId),
        );

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const values = {
          orderIndex: i,
          title: p.title,
          bunnyVideoId: p.bunnyVideoId,
          durationSeconds: p.durationSeconds,
        };
        if (p.id && owned.has(p.id)) {
          await tx
            .update(lessonVideos)
            .set({ ...values, updatedAt: sql`now()` })
            .where(and(eq(lessonVideos.id, p.id), eq(lessonVideos.lessonId, lessonId)));
        } else {
          await tx.insert(lessonVideos).values({ ...values, lessonId });
        }
      }

      const known = parts.map((p) => p.durationSeconds);
      const total = known.some((d) => d != null)
        ? known.reduce<number>((sum, d) => sum + (d ?? 0), 0)
        : null;
      await tx
        .update(lessons)
        .set({ durationSeconds: total, updatedAt: sql`now()` })
        .where(eq(lessons.id, lessonId));
    });
  },
};

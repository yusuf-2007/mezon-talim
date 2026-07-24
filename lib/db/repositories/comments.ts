import "server-only";
import { count, desc, eq, or } from "drizzle-orm";
import { db } from "../client";
import { lessonComments, lessons, modules, userAvatars, users } from "../schema";

export type LessonComment = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string | null;
  authorRole: "student" | "teacher" | "super_admin" | "accountant";
  authorHasAvatar: boolean;
};

/**
 * Per-lesson discussion comments (B19). Reads join the author's name/role (to
 * badge instructors) and avatar presence. Authorization for writes lives in
 * the community actions, not here.
 */
export const commentsRepository = {
  /** All comments for a lesson, newest-first; the panel groups threads. */
  async listForLesson(lessonId: string): Promise<LessonComment[]> {
    const rows = await db
      .select({
        id: lessonComments.id,
        parentId: lessonComments.parentId,
        body: lessonComments.body,
        createdAt: lessonComments.createdAt,
        authorId: lessonComments.userId,
        authorName: users.fullName,
        authorRole: users.role,
        avatarUserId: userAvatars.userId,
      })
      .from(lessonComments)
      .innerJoin(users, eq(users.id, lessonComments.userId))
      .leftJoin(userAvatars, eq(userAvatars.userId, lessonComments.userId))
      .where(eq(lessonComments.lessonId, lessonId))
      .orderBy(desc(lessonComments.createdAt));
    return rows.map(({ avatarUserId, ...r }) => ({
      ...r,
      authorHasAvatar: avatarUserId != null,
    }));
  },

  async findById(commentId: string) {
    const [row] = await db
      .select()
      .from(lessonComments)
      .where(eq(lessonComments.id, commentId))
      .limit(1);
    return row ?? null;
  },

  async create(input: {
    userId: string;
    lessonId: string;
    body: string;
    parentId: string | null;
  }) {
    const [row] = await db.insert(lessonComments).values(input).returning();
    return row;
  },

  /** Hard delete; replies cascade at the DB level (YouTube semantics). */
  async remove(commentId: string) {
    await db.delete(lessonComments).where(eq(lessonComments.id, commentId));
  },

  /** Distinct authors in a flattened thread (root + all replies). */
  async threadParticipants(threadRootId: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ userId: lessonComments.userId })
      .from(lessonComments)
      .where(
        or(
          eq(lessonComments.id, threadRootId),
          eq(lessonComments.parentId, threadRootId),
        ),
      );
    return rows.map((r) => r.userId);
  },

  /** Comment totals per lesson (with owning course) for the admin pickers. */
  async countsByLesson(): Promise<
    { lessonId: string; courseId: string; n: number }[]
  > {
    return db
      .select({
        lessonId: lessonComments.lessonId,
        courseId: modules.courseId,
        n: count(),
      })
      .from(lessonComments)
      .innerJoin(lessons, eq(lessons.id, lessonComments.lessonId))
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .groupBy(lessonComments.lessonId, modules.courseId);
  },

  async countForLesson(lessonId: string): Promise<number> {
    const [row] = await db
      .select({ n: count() })
      .from(lessonComments)
      .where(eq(lessonComments.lessonId, lessonId));
    return row?.n ?? 0;
  },
};

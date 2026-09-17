import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../client";
import { lessonMessages, lessons, modules, users } from "../schema";

export type LessonMessage = {
  id: string;
  studentId: string;
  studentName: string | null;
  senderId: string;
  senderName: string | null;
  senderRole: "student" | "teacher" | "super_admin" | "accountant";
  body: string;
  createdAt: Date;
};

const students = alias(users, "thread_students");

const messageColumns = {
  id: lessonMessages.id,
  studentId: lessonMessages.studentId,
  studentName: students.fullName,
  senderId: lessonMessages.senderId,
  senderName: users.fullName,
  senderRole: users.role,
  body: lessonMessages.body,
  createdAt: lessonMessages.createdAt,
};

/**
 * Private student→instructor messages, one thread per (lesson, student).
 * Reads here are unscoped — the caller decides which thread(s) the viewer may
 * see (own thread for students; all threads for the course owner/super admin).
 * Write authorization lives in the community message actions.
 */
export const messagesRepository = {
  /** One student's thread on a lesson, oldest-first (chat order). */
  async listThread(lessonId: string, studentId: string): Promise<LessonMessage[]> {
    return db
      .select(messageColumns)
      .from(lessonMessages)
      .innerJoin(users, eq(users.id, lessonMessages.senderId))
      .innerJoin(students, eq(students.id, lessonMessages.studentId))
      .where(
        and(
          eq(lessonMessages.lessonId, lessonId),
          eq(lessonMessages.studentId, studentId),
        ),
      )
      .orderBy(asc(lessonMessages.createdAt), asc(lessonMessages.id));
  },

  /** Every thread on a lesson (instructor view); the panel groups by student. */
  async listThreadsForLesson(lessonId: string): Promise<LessonMessage[]> {
    return db
      .select(messageColumns)
      .from(lessonMessages)
      .innerJoin(users, eq(users.id, lessonMessages.senderId))
      .innerJoin(students, eq(students.id, lessonMessages.studentId))
      .where(eq(lessonMessages.lessonId, lessonId))
      .orderBy(asc(lessonMessages.createdAt), asc(lessonMessages.id));
  },

  /**
   * All of one student's threads across every course (dashboard Messages),
   * message-ordered; the panel groups by lesson. Includes lesson/course
   * context for linking back into the player.
   */
  async listThreadsForStudent(studentId: string) {
    return db
      .select({
        ...messageColumns,
        lessonId: lessonMessages.lessonId,
        lessonTitle: lessons.title,
        courseId: modules.courseId,
      })
      .from(lessonMessages)
      .innerJoin(users, eq(users.id, lessonMessages.senderId))
      .innerJoin(students, eq(students.id, lessonMessages.studentId))
      .innerJoin(lessons, eq(lessons.id, lessonMessages.lessonId))
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .where(eq(lessonMessages.studentId, studentId))
      .orderBy(asc(lessonMessages.createdAt), asc(lessonMessages.id));
  },

  /**
   * Threads where the student spoke last — i.e. still waiting on the
   * instructor. Drives the badge in the dashboard rail, so it counts threads
   * rather than messages: three follow-ups on one question are one wait.
   */
  async awaitingReplyCount(studentId: string): Promise<number> {
    const latest = db
      .selectDistinctOn([lessonMessages.lessonId], {
        lessonId: lessonMessages.lessonId,
        senderId: lessonMessages.senderId,
      })
      .from(lessonMessages)
      .where(eq(lessonMessages.studentId, studentId))
      .orderBy(
        asc(lessonMessages.lessonId),
        desc(lessonMessages.createdAt),
        desc(lessonMessages.id),
      )
      .as("latest");

    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(latest)
      .where(eq(latest.senderId, studentId));
    return Number(row?.n ?? 0);
  },

  /** Does the student have an open thread on this lesson? */
  async hasThread(lessonId: string, studentId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: lessonMessages.id })
      .from(lessonMessages)
      .where(
        and(
          eq(lessonMessages.lessonId, lessonId),
          eq(lessonMessages.studentId, studentId),
        ),
      )
      .limit(1);
    return row != null;
  },

  async create(input: {
    lessonId: string;
    studentId: string;
    senderId: string;
    body: string;
  }) {
    const [row] = await db.insert(lessonMessages).values(input).returning();
    return row;
  },

  /**
   * Open threads across the whole school, oldest first — the admin queue.
   *
   * "Open" means the student spoke last. One row per thread carrying the
   * student's latest message, so the admin home can show the question itself
   * and how long it has been sitting without a second round trip.
   */
  async openThreadsForAdmin(limit = 20) {
    const student = alias(users, "thread_student");
    const latest = db
      .selectDistinctOn([lessonMessages.lessonId, lessonMessages.studentId], {
        id: lessonMessages.id,
        lessonId: lessonMessages.lessonId,
        studentId: lessonMessages.studentId,
        senderId: lessonMessages.senderId,
        body: lessonMessages.body,
        createdAt: lessonMessages.createdAt,
      })
      .from(lessonMessages)
      .orderBy(
        lessonMessages.lessonId,
        lessonMessages.studentId,
        desc(lessonMessages.createdAt),
        desc(lessonMessages.id),
      )
      .as("latest");

    return db
      .select({
        id: latest.id,
        lessonId: latest.lessonId,
        lessonTitle: lessons.title,
        courseId: modules.courseId,
        studentId: latest.studentId,
        studentName: student.fullName,
        body: latest.body,
        createdAt: latest.createdAt,
      })
      .from(latest)
      .innerJoin(lessons, eq(lessons.id, latest.lessonId))
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .innerJoin(student, eq(student.id, latest.studentId))
      .where(eq(latest.senderId, latest.studentId))
      .orderBy(asc(latest.createdAt))
      .limit(limit);
  },

  /**
   * Threads still awaiting an instructor reply (their LATEST message is from
   * the student), counted per lesson with the owning course — feeds the
   * "needs reply" badges in the admin Messages pickers.
   */
  async unansweredCounts(): Promise<
    { lessonId: string; courseId: string; n: number }[]
  > {
    const latest = db
      .selectDistinctOn([lessonMessages.lessonId, lessonMessages.studentId], {
        lessonId: lessonMessages.lessonId,
        studentId: lessonMessages.studentId,
        senderId: lessonMessages.senderId,
      })
      .from(lessonMessages)
      .orderBy(
        lessonMessages.lessonId,
        lessonMessages.studentId,
        desc(lessonMessages.createdAt),
        desc(lessonMessages.id),
      )
      .as("latest");

    return db
      .select({
        lessonId: latest.lessonId,
        courseId: modules.courseId,
        n: count(),
      })
      .from(latest)
      .innerJoin(lessons, eq(lessons.id, latest.lessonId))
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .where(eq(latest.senderId, latest.studentId))
      .groupBy(latest.lessonId, modules.courseId);
  },
};

import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../client";
import { lessonMessages, users } from "../schema";

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
};

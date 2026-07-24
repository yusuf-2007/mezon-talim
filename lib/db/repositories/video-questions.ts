import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import { videoQuestionResponses, videoQuestions } from "../schema";
import type { LocalizedText } from "../schema";

/**
 * In-video popup questions. Reads for the player must go through
 * `listForLessonWithAnswers` and be serialized WITHOUT `correctIndex` — the
 * correct answer is only revealed by the answer action.
 */
export const videoQuestionsRepository = {
  /** Authoring view (studio): full rows, playback order. */
  async listForLesson(lessonId: string) {
    return db
      .select()
      .from(videoQuestions)
      .where(eq(videoQuestions.lessonId, lessonId))
      .orderBy(asc(videoQuestions.timestampSeconds), asc(videoQuestions.id));
  },

  /** Player view: questions + whether this student already answered each. */
  async listForLessonWithAnswers(lessonId: string, userId: string) {
    const rows = await db
      .select({
        id: videoQuestions.id,
        timestampSeconds: videoQuestions.timestampSeconds,
        prompt: videoQuestions.prompt,
        options: videoQuestions.options,
        answeredIndex: videoQuestionResponses.selectedIndex,
        answeredCorrect: videoQuestionResponses.isCorrect,
      })
      .from(videoQuestions)
      .leftJoin(
        videoQuestionResponses,
        and(
          eq(videoQuestionResponses.questionId, videoQuestions.id),
          eq(videoQuestionResponses.userId, userId),
        ),
      )
      .where(eq(videoQuestions.lessonId, lessonId))
      .orderBy(asc(videoQuestions.timestampSeconds), asc(videoQuestions.id));
    return rows;
  },

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(videoQuestions)
      .where(eq(videoQuestions.id, id))
      .limit(1);
    return row ?? null;
  },

  async create(input: {
    lessonId: string;
    timestampSeconds: number;
    prompt: LocalizedText;
    options: LocalizedText[];
    correctIndex: number;
  }) {
    const [row] = await db.insert(videoQuestions).values(input).returning();
    return row;
  },

  async remove(id: string) {
    await db.delete(videoQuestions).where(eq(videoQuestions.id, id));
  },

  /** Record (or overwrite) the student's answer; latest wins. */
  async answer(input: {
    questionId: string;
    userId: string;
    selectedIndex: number;
    isCorrect: boolean;
  }) {
    await db
      .insert(videoQuestionResponses)
      .values(input)
      .onConflictDoUpdate({
        target: [videoQuestionResponses.questionId, videoQuestionResponses.userId],
        set: {
          selectedIndex: input.selectedIndex,
          isCorrect: input.isCorrect,
        },
      });
  },
};

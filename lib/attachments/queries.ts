import "server-only";
import { lessonAttachmentsRepository } from "@/lib/db/repositories/lesson-attachments";
import { isAttachmentStorageConfigured } from "@/lib/storage";
import { toSlideDeck, toStudioAttachment, type LessonSlideDeck, type StudioAttachment } from "./dto";

export { isAttachmentStorageConfigured };

/**
 * Studio / Admin: every attachment (any status, so stuck uploads can be
 * retried or removed) of the given lessons, keyed by lesson id. Lessons with
 * none are absent from the record.
 */
export async function loadStudioAttachments(
  lessonIds: string[],
): Promise<Record<string, StudioAttachment[]>> {
  const grouped = await lessonAttachmentsRepository.listByLessons(lessonIds);
  const out: Record<string, StudioAttachment[]> = {};
  for (const [lessonId, rows] of grouped) out[lessonId] = rows.map(toStudioAttachment);
  return out;
}

/**
 * Student lesson page: the ready decks of one lesson, localized. Empty when
 * attachment storage is not configured (slides could not be served anyway).
 * The caller must already have decided the viewer may open the lesson.
 */
export async function loadLessonSlideDecks(
  lessonId: string,
  locale: string,
): Promise<LessonSlideDeck[]> {
  if (!isAttachmentStorageConfigured()) return [];
  const rows = await lessonAttachmentsRepository.listByLesson(lessonId, { readyOnly: true });
  return rows.map((row) => toSlideDeck(row, locale));
}

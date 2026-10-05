import "server-only";
import { deletePrefix, getAttachmentsBucket, isAttachmentStorageConfigured } from "@/lib/storage";
import { lessonAttachmentsPrefix } from "./keys";

/**
 * Remove every stored attachment object of these lessons (originals and
 * slides), for when their rows go away without deleteAttachmentAction — a
 * hard module delete cascades lessons → lesson_attachments in the database,
 * and those rows were the only record of where the bytes live.
 *
 * Deletes the whole lesson-level prefix, so it also catches leftovers of rows
 * that are already gone. Best effort, like deleteAttachmentAction: a storage
 * outage is logged and never fails the caller. Call it only AFTER the rows
 * are deleted — the other order could leave live rows pointing at removed
 * slides if the delete then failed.
 *
 * Not a server action (this file has no "use server"): callers authorize.
 */
export async function purgeLessonAttachmentObjects(lessonIds: string[]): Promise<void> {
  if (lessonIds.length === 0 || !isAttachmentStorageConfigured()) return;
  const bucket = getAttachmentsBucket();
  // One at a time: a module holds tens of lessons, each a list (+ delete).
  for (const lessonId of lessonIds) {
    const prefix = lessonAttachmentsPrefix(lessonId);
    if (!(await deletePrefix(prefix, bucket))) {
      console.error(`[attachments] could not remove objects under ${prefix}`);
    }
  }
}

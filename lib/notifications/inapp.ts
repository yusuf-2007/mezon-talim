import "server-only";
import {
  userNotificationsRepository,
  type UserNotificationType,
} from "@/lib/db/repositories/user-notifications";

/**
 * Fire an in-app notification, best-effort: never notifies yourself, never
 * throws — a bell failure must not break the comment/message that caused it.
 */
export async function fireInAppNotification(input: {
  userId: string | null | undefined;
  actorUserId: string;
  type: UserNotificationType;
  courseId: string;
  lessonId: string;
  body: string;
  /** Cascade handles: deleting the source also deletes this notification. */
  sourceCommentId?: string | null;
  sourceMessageId?: string | null;
}): Promise<void> {
  const { userId, body, ...rest } = input;
  if (!userId || userId === input.actorUserId) return;
  try {
    await userNotificationsRepository.create({
      userId,
      ...rest,
      excerpt: body.length > 140 ? `${body.slice(0, 139)}…` : body,
    });
  } catch (err) {
    console.error("[inapp-notification] create failed", err);
  }
}

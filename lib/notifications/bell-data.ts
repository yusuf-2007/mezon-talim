import "server-only";
import { userNotificationsRepository } from "@/lib/db/repositories/user-notifications";
import { pickLocale } from "@/lib/i18n/localized";

/** Serialized notification as consumed by the bell dropdown / list page. */
export type BellItem = {
  id: string;
  type: string;
  actorName: string | null;
  lessonTitle: string | null;
  excerpt: string | null;
  read: boolean;
  createdAt: string;
  href: string;
};

/** Which player tab / admin section a notification type deep-links to. */
function tabFor(type: string): string {
  return type === "private_question" || type === "private_reply"
    ? "ask"
    : "discussion";
}

/**
 * Super admins land in the admin Messages panel (their working surface, and
 * immune to the player's enrollment/sequential-lock rules); everyone else
 * deep-links into the lesson player tab.
 */
function hrefFor(
  role: string,
  type: string,
  courseId: string,
  lessonId: string,
): string {
  const tab = tabFor(type);
  return role === "super_admin"
    ? `/admin/messages?section=${tab === "ask" ? "ask" : "discussion"}&courseId=${courseId}&lessonId=${lessonId}`
    : `/learn/${courseId}/${lessonId}?tab=${tab}`;
}

/**
 * The single source for bell/list data: unread count + a serialized window of
 * items (dates → ISO, titles → localized strings, role-aware deep links).
 */
export async function getBellData(
  userId: string,
  role: string,
  locale: string,
  limit = 15,
  offset = 0,
): Promise<{ unread: number; items: BellItem[] }> {
  const [unread, rows] = await Promise.all([
    userNotificationsRepository.unreadCount(userId),
    userNotificationsRepository.listForUser(userId, limit, offset),
  ]);
  return {
    unread,
    items: rows.map((n) => ({
      id: n.id,
      type: n.type,
      actorName: n.actorName,
      lessonTitle: n.lessonTitle ? pickLocale(n.lessonTitle, locale) : null,
      excerpt: n.excerpt,
      read: n.readAt != null,
      createdAt: n.createdAt.toISOString(),
      href: hrefFor(role, n.type, n.courseId, n.lessonId),
    })),
  };
}

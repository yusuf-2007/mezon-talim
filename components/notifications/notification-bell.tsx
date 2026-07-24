import { getLocale } from "next-intl/server";
import { userNotificationsRepository } from "@/lib/db/repositories/user-notifications";
import { pickLocale } from "@/lib/i18n/localized";
import { NotificationDropdown } from "./notification-dropdown";

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
 * Server half of the header bell: fetches the unread count and the latest
 * items for the signed-in user, serializes them (dates → ISO, titles →
 * localized strings, deep-link built per type) and hands off to the client
 * dropdown. Rendered on every page via SiteHeader.
 */
export async function NotificationBell({
  userId,
  role,
}: {
  userId: string;
  role: string;
}) {
  const locale = await getLocale();
  const [unread, items] = await Promise.all([
    userNotificationsRepository.unreadCount(userId),
    userNotificationsRepository.listForUser(userId, 15),
  ]);

  return (
    <NotificationDropdown
      unread={unread}
      items={items.map((n) => ({
        id: n.id,
        type: n.type,
        actorName: n.actorName,
        lessonTitle: n.lessonTitle ? pickLocale(n.lessonTitle, locale) : null,
        excerpt: n.excerpt,
        read: n.readAt != null,
        createdAt: n.createdAt.toISOString(),
        href: hrefFor(role, n.type, n.courseId, n.lessonId),
      }))}
    />
  );
}

import { getLocale } from "next-intl/server";
import { getBellData } from "@/lib/notifications/bell-data";
import { NotificationDropdown } from "./notification-dropdown";

/**
 * Server half of the header bell: fetches the initial unread count + latest
 * items for the signed-in user and hands off to the client dropdown, which
 * keeps itself fresh via /api/notifications. Rendered on every page.
 */
export async function NotificationBell({
  userId,
  role,
}: {
  userId: string;
  role: string;
}) {
  const locale = await getLocale();
  const { unread, items } = await getBellData(userId, role, locale);
  return <NotificationDropdown initialUnread={unread} initialItems={items} />;
}

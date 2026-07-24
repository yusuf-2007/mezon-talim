import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getBellData } from "@/lib/notifications/bell-data";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { NotificationItems } from "@/components/notifications/notification-items";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";

const PAGE_SIZE = 30;

/** Full notification history (the bell dropdown shows only the latest 15). */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const locale = await getLocale();
  const t = await getTranslations("Notifications");
  const sp = await searchParams;

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  // Fetch one extra row to know whether an older page exists.
  const { unread, items } = await getBellData(
    user.id,
    user.role,
    locale,
    PAGE_SIZE + 1,
    (page - 1) * PAGE_SIZE,
  );
  const hasOlder = items.length > PAGE_SIZE;
  const visible = items.slice(0, PAGE_SIZE);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold text-navy-800">
          {t("title")}
        </h1>
        {unread > 0 && <MarkAllReadButton />}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            {t("empty")}
          </p>
        ) : (
          <NotificationItems items={visible} />
        )}
      </div>

      {(page > 1 || hasOlder) && (
        <div className="mt-4 flex justify-between">
          {page > 1 ? (
            <Button
              render={<Link href={{ pathname: "/notifications", query: page - 1 > 1 ? { page: String(page - 1) } : {} }} />}
              variant="outline"
              size="sm"
            >
              ← {t("newer")}
            </Button>
          ) : (
            <span />
          )}
          {hasOlder && (
            <Button
              render={<Link href={{ pathname: "/notifications", query: { page: String(page + 1) } }} />}
              variant="outline"
              size="sm"
            >
              {t("older")} →
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

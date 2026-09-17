import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { NotificationBell } from "@/components/notifications/notification-bell";

/**
 * The header every admin view shares: gold eyebrow naming the section, serif
 * title saying what this page is, and on the right the global search and one
 * gold action.
 *
 * The search is a plain GET form to /admin/users, which already reads `?q=`.
 * A command palette is the eventual shape, but a form works without JS and
 * without a second index to keep honest.
 */
export async function AdminPageHeader({
  eyebrow,
  title,
  action,
  userId,
  role,
}: {
  eyebrow: string;
  title: string;
  /** The one gold button for this view, if it has one. */
  action?: React.ReactNode;
  userId: string;
  role: string;
}) {
  const t = await getTranslations("Admin");

  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        <p className="mb-1.5 text-[.74rem] font-bold uppercase tracking-[.16em] text-lp-gold-deep">
          {eyebrow}
        </p>
        <h1 className="font-lp-heading text-[1.65rem] font-semibold leading-tight tracking-[-.01em] text-lp-navy">
          {title}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <form action="/admin/users" className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-lp-muted"
            strokeWidth={2}
          />
          <input
            type="search"
            name="q"
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="min-h-10 w-full min-w-[15rem] rounded-[10px] border-[1.5px] border-lp-line bg-surface py-2 pl-9 pr-3 text-[.9rem] text-lp-ink outline-none transition-colors placeholder:text-lp-muted-light focus:border-lp-navy focus:ring-[3px] focus:ring-lp-gold/35"
          />
        </form>
        {/* The comp's top bar has no bell, but the old shell carried one and
            it is how staff learn a student asked something. Keeping it. */}
        <NotificationBell userId={userId} role={role} />
        {action}
      </div>
    </header>
  );
}

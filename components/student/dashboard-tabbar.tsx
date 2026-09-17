"use client";

import { useState } from "react";
import { Award, BookOpen, LayoutGrid, Menu, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { UserAvatar } from "@/components/admin/user-avatar";
import { LogoutButton } from "@/components/auth/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { RAIL_GROUPS, isRailActive } from "./dashboard-rail";
import { cn } from "@/lib/utils";

/**
 * Mobile navigation: four destinations plus a sheet for the rest.
 *
 * Seven destinations do not fit a tab bar, and the four here are the ones a
 * student opens daily. Catalogue, glossary and settings are occasional, so
 * they live behind "Menu" — the same split the rail makes between its two
 * groups, rather than a second arbitrary one.
 */
export function DashboardTabBar({
  name,
  email,
  hasAvatar,
  userId,
  unreadMessages,
}: {
  name: string;
  email: string | null;
  hasAvatar: boolean;
  userId: string;
  unreadMessages: number;
}) {
  const t = useTranslations("Student");
  const pathname = usePathname();
  /**
   * The route the sheet was opened on. Navigating changes the pathname, which
   * closes the sheet without an effect having to watch for it — a tap that
   * navigates should dismiss it, and this is that rule stated once.
   */
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const setOpen = (next: boolean) => setOpenedAt(next ? pathname : null);

  const primary = [
    { href: "/dashboard", labelKey: "navHome", Icon: LayoutGrid },
    { href: "/dashboard/courses", labelKey: "navCourses", Icon: BookOpen },
    { href: "/dashboard/messages", labelKey: "navMessages", Icon: MessageSquare },
    { href: "/dashboard/certificates", labelKey: "navCertificates", Icon: Award },
  ] as const;

  const secondary = RAIL_GROUPS[1].items;
  const inSecondary = secondary.some((i) => isRailActive(pathname, i.href));

  return (
    <>
      {open && (
        <>
          <button
            type="button"
            aria-label={t("cancel")}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-lp-navy-deep/45 lg:hidden"
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[55] flex flex-col rounded-t-[18px] bg-surface px-5 pb-7 pt-3.5 shadow-[0_-12px_40px_rgba(2,58,105,.18)] lg:hidden"
            style={{ paddingBottom: "calc(1.75rem + env(safe-area-inset-bottom))" }}
          >
            <span aria-hidden className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-lp-line-strong" />
            <div className="mb-2 flex items-center gap-3 border-b border-lp-line-soft pb-3.5">
              <UserAvatar
                name={name}
                email={email}
                src={hasAvatar ? `/api/avatars/${userId}` : null}
                className="size-10 shrink-0 text-[.8rem]"
              />
              <div className="min-w-0">
                <p className="truncate text-[.95rem] font-bold text-lp-ink">{name}</p>
                <p className="text-[.78rem] text-lp-muted">{t("studentBadge")}</p>
              </div>
            </div>
            {secondary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-12 items-center gap-3.5 border-b border-lp-line-soft text-[.98rem] font-semibold text-lp-ink"
              >
                <item.icon className="size-5 text-lp-navy" strokeWidth={1.75} />
                {t(item.labelKey)}
              </Link>
            ))}
            <div className="flex items-center justify-between gap-3 pt-4">
              <LanguageSwitcher />
              <LogoutButton variant="ghost" />
            </div>
          </div>
        </>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-lp-line bg-surface/95 px-1.5 pb-2.5 pt-2 backdrop-blur lg:hidden"
        style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
      >
        {primary.map(({ href, labelKey, Icon }) => {
          const active = isRailActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-16 flex-col items-center gap-1 text-[.68rem] font-bold",
                active ? "text-lp-navy" : "text-lp-muted",
              )}
            >
              <Icon className="size-5" strokeWidth={1.75} />
              {t(labelKey)}
              {href === "/dashboard/messages" && unreadMessages > 0 && (
                <span className="absolute -top-0.5 right-3 size-2 rounded-full border-[1.5px] border-surface bg-lp-gold" />
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={cn(
            "flex min-w-16 flex-col items-center gap-1 text-[.68rem] font-bold",
            open || inSecondary ? "text-lp-navy" : "text-lp-muted",
          )}
        >
          <Menu className="size-5" strokeWidth={1.75} />
          {t("menuLabel")}
        </button>
      </nav>
    </>
  );
}

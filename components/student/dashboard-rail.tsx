"use client";

import {
  Award,
  BookOpen,
  BookText,
  LayoutGrid,
  type LucideIcon,
  MessageSquare,
  Settings,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { UserAvatar } from "@/components/admin/user-avatar";
import { LogoutButton } from "@/components/auth/logout-button";
import { RailLanguage } from "./dashboard-rail-language";
import { cn } from "@/lib/utils";

/** next-intl types t() to the namespace's keys, so the label must be one. */
type StudentKey = Parameters<ReturnType<typeof useTranslations<"Student">>>[0];

export type RailItem = { href: string; labelKey: StudentKey; icon: LucideIcon };

/** The two groups the design splits the destinations into. */
export const RAIL_GROUPS: { labelKey: StudentKey; items: RailItem[] }[] = [
  {
    labelKey: "railStudy",
    items: [
      { href: "/dashboard", labelKey: "navHome", icon: LayoutGrid },
      { href: "/dashboard/courses", labelKey: "navCourses", icon: BookOpen },
      {
        href: "/dashboard/messages",
        labelKey: "navMessages",
        icon: MessageSquare,
      },
      {
        href: "/dashboard/certificates",
        labelKey: "navCertificates",
        icon: Award,
      },
    ],
  },
  {
    labelKey: "railOther",
    items: [
      { href: "/dashboard/catalog", labelKey: "navCatalog", icon: LayoutGrid },
      { href: "/dashboard/glossary", labelKey: "navGlossary", icon: BookText },
      { href: "/dashboard/settings", labelKey: "navSettings", icon: Settings },
    ],
  },
];

export function isRailActive(pathname: string, href: string): boolean {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(href);
}

/**
 * Persistent navy rail, desktop only (the tab bar takes over below `lg`).
 *
 * Navy rather than the app's usual white chrome: the student area is where
 * someone spends an hour at a time, and a dark rail pushes the reading surface
 * forward instead of competing with it. Flat navy, no motif: the comp tiled a
 * faint diamond lattice here, but at full size it reads as a visible grid
 * rather than texture. The landing page reached the same conclusion.
 */
export function DashboardRail({
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

  return (
    <aside className="hidden bg-lp-navy lg:block">
      <div className="sticky top-0 flex h-screen flex-col overflow-hidden px-3.5 pb-4 pt-5">
        <div className="relative flex h-full min-h-0 flex-col">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-2.5 pt-1"
          >
            <span
              aria-hidden
              className="relative inline-block h-6 w-[30px] shrink-0"
            >
              <span className="absolute left-0 top-0 h-6 w-[13px] -skew-x-6 rounded-l-[6px] rounded-tl-[3px] bg-[#9BB8D4]" />
              <span className="absolute right-0 top-0 h-6 w-[13px] skew-x-6 rounded-r-[6px] rounded-tr-[3px] bg-lp-gold" />
            </span>
            <span className="font-lp-heading text-[1.15rem] font-semibold leading-none">
              <span className="text-white">Mezon</span>{" "}
              <span className="text-lp-gold">Ta&rsquo;lim</span>
            </span>
          </Link>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {RAIL_GROUPS.map((group) => (
              <div key={group.labelKey}>
                <p className="px-3 pb-2.5 pt-7 text-[.66rem] font-bold uppercase tracking-[.16em] text-lp-on-navy-faint">
                  {t(group.labelKey)}
                </p>
                <nav className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = isRailActive(pathname, item.href);
                    const badge =
                      item.href === "/dashboard/messages" ? unreadMessages : 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center justify-between rounded-[10px] px-3 text-[.92rem] font-semibold transition-colors",
                          active
                            ? "bg-white/[.12] text-white"
                            : "text-lp-on-navy hover:bg-white/[.08]",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <item.icon
                            className="size-[18px] shrink-0"
                            strokeWidth={1.75}
                          />
                          {t(item.labelKey)}
                        </span>
                        {badge > 0 && (
                          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-lp-gold px-1.5 text-[.7rem] font-extrabold text-lp-navy-deep">
                            {badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          <div className="mt-auto border-t border-white/10 pt-4">
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 transition-colors hover:bg-white/[.08]"
            >
              <UserAvatar
                name={name}
                email={email}
                src={hasAvatar ? `/api/avatars/${userId}` : null}
                className="size-9 shrink-0 text-[.78rem]"
              />
              <span className="min-w-0">
                <span className="block truncate text-[.88rem] font-bold text-white">
                  {name}
                </span>
                <span className="block text-[.74rem] text-lp-on-navy-dim">
                  {t("studentBadge")}
                </span>
              </span>
            </Link>
            <div className="flex items-center justify-between gap-2.5 px-2.5 pt-2.5">
              <RailLanguage />
              <LogoutButton
                variant="ghost"
                size="sm"
                className="text-lp-on-navy hover:bg-white/10 hover:text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

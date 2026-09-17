"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/lib/i18n/navigation";
import { LogoutButton } from "@/components/auth/logout-button";

import { BookMark, RailRow } from "./admin-rail";
import {
  isAdminNavActive,
  visibleGroups,
  type AdminNavBadges,
} from "./admin-nav-model";

type AdminKey = Parameters<ReturnType<typeof useTranslations<"Admin">>>[0];

/**
 * Admin navigation below `lg`: a slim top bar with a menu button that opens the
 * full grouped list in a drawer.
 *
 * The student side uses five bottom tabs, which works because a student has
 * five places to be. Admin has fifteen across five groups, and picking five to
 * privilege would bury the rest — so the whole tree opens at once instead. The
 * badge totals ride on the button, so "something is waiting" is visible without
 * opening anything.
 *
 * Open state is derived from the pathname rather than synced to it: navigating
 * changes `pathname`, which closes the drawer with no effect and no stale
 * state if the browser restores a back-navigation.
 */
export function AdminMobileNav({
  canManage,
  badges,
  name,
  roleLabel,
  initials,
}: {
  canManage: boolean;
  badges: AdminNavBadges;
  name: string;
  roleLabel: string;
  initials: string;
}) {
  const t = useTranslations("Admin");
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;

  const groups = visibleGroups(canManage);
  const waiting = groups
    .flatMap((g) => g.items)
    .reduce((sum, i) => sum + (i.badgeKey ? (badges[i.badgeKey] ?? 0) : 0), 0);

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-lp-navy px-4 py-3 lg:hidden">
        <span className="flex items-center gap-2">
          <BookMark />
          <span className="whitespace-nowrap font-lp-heading text-[1.1rem] font-semibold leading-none">
            <span className="text-white">Mezon</span>{" "}
            <span className="text-lp-gold">Ta&rsquo;lim</span>
          </span>
          <span className="shrink-0 rounded-[5px] bg-lp-gold px-[7px] py-[3px] text-[.66rem] font-extrabold uppercase tracking-[.12em] text-lp-navy-deep">
            {t("railAdminChip")}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setOpenedAt(pathname)}
          aria-expanded={open}
          className="relative flex size-10 shrink-0 items-center justify-center rounded-[9px] text-white transition-colors hover:bg-white/10"
        >
          <Menu className="size-5" strokeWidth={1.9} />
          <span className="sr-only">{t("navOpenMenu")}</span>
          {waiting > 0 && (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-lp-gold"
            />
          )}
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("navCloseMenu")}
            onClick={() => setOpenedAt(null)}
            className="absolute inset-0 bg-[rgb(1_30_56/0.45)]"
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(19rem,88vw)] flex-col overflow-y-auto bg-lp-navy px-3.5 pb-5 pt-4 shadow-[12px_0_40px_rgba(2,58,105,.18)]">
            <div className="flex items-center justify-between gap-2 px-2.5">
              <span className="font-lp-heading text-[1.1rem] font-semibold leading-none text-white">
                {t("title")}
              </span>
              <button
                type="button"
                onClick={() => setOpenedAt(null)}
                className="flex size-9 items-center justify-center rounded-[9px] text-lp-on-navy transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" strokeWidth={1.9} />
                <span className="sr-only">{t("navCloseMenu")}</span>
              </button>
            </div>

            {groups.map((group) => (
              <div key={group.labelKey}>
                <p className="px-3 pb-2 pt-5 text-[.66rem] font-bold uppercase tracking-[.16em] text-lp-on-navy-faint">
                  {t(group.labelKey as AdminKey)}
                </p>
                <nav className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <RailRow
                      key={item.href}
                      item={item}
                      active={isAdminNavActive(pathname, item.href)}
                      label={t(item.labelKey as AdminKey)}
                      count={item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0}
                      onNavigate={() => setOpenedAt(null)}
                    />
                  ))}
                </nav>
              </div>
            ))}

            <div className="mt-auto border-t border-white/10 px-2.5 pt-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lp-navy-mid text-[.78rem] font-extrabold text-white">
                  {initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[.88rem] font-bold text-white">
                    {name}
                  </span>
                  <span className="block text-[.74rem] text-lp-on-navy-dim">{roleLabel}</span>
                </span>
              </div>
              <LogoutButton
                variant="ghost"
                size="sm"
                className="mt-1 w-full justify-start px-0 text-lp-on-navy hover:bg-white/10 hover:text-white"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}


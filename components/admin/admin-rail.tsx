"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  isAdminNavActive,
  visibleGroups,
  type AdminNavBadges,
  type AdminNavItem,
} from "./admin-nav-model";

/** next-intl types t() to the namespace's keys, so a label must be one. */
type AdminKey = Parameters<ReturnType<typeof useTranslations<"Admin">>>[0];

export type AdminRailProps = {
  name: string;
  roleLabel: string;
  initials: string;
  canManage: boolean;
  badges: AdminNavBadges;
};

/**
 * Persistent navy rail for the admin area, desktop only.
 *
 * Same navy and the same nav vocabulary as the student rail, so staff and
 * students read as one product rather than two apps that happen to share a
 * logo. Wider than the student's (244 vs 236) because the labels are longer
 * and several rows carry a count.
 *
 * Flat navy, no lattice: the comp tiles a faint diamond motif here, and we
 * dropped it on the student side and the landing page for reading as a grid
 * rather than as texture.
 */
export function AdminRail({
  name,
  roleLabel,
  initials,
  canManage,
  badges,
}: AdminRailProps) {
  const t = useTranslations("Admin");
  const pathname = usePathname();
  const groups = visibleGroups(canManage);

  return (
    <aside className="hidden bg-lp-navy lg:block">
      <div className="sticky top-0 flex h-screen flex-col overflow-y-auto px-3.5 pb-4 pt-5">
        <div className="flex items-center justify-between gap-2 px-2.5 pt-1">
          <Link href="/admin" className="flex items-center gap-2">
            <BookMark />
            <span className="whitespace-nowrap font-lp-heading text-[1.1rem] font-semibold leading-none">
              <span className="text-white">Mezon</span>{" "}
              <span className="text-lp-gold">Ta&rsquo;lim</span>
            </span>
          </Link>
          <span className="shrink-0 rounded-[5px] bg-lp-gold px-[7px] py-[3px] text-[.66rem] font-extrabold uppercase tracking-[.12em] text-lp-navy-deep">
            {t("railAdminChip")}
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-0.5">
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
                  />
                ))}
              </nav>
            </div>
          ))}
        </div>

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-center gap-2.5 px-2.5 py-1.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lp-navy-mid text-[.78rem] font-extrabold text-white">
              {initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[.88rem] font-bold text-white">{name}</span>
              <span className="block text-[.74rem] text-lp-on-navy-dim">{roleLabel}</span>
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** The two skewed pages of the Mezon mark. */
export function BookMark() {
  return (
    <span aria-hidden className="relative inline-block h-6 w-[30px] shrink-0">
      <span className="absolute left-0 top-0 h-6 w-[13px] -skew-x-6 rounded-l-[6px] rounded-tl-[3px] bg-[#9BB8D4]" />
      <span className="absolute right-0 top-0 h-6 w-[13px] skew-x-6 rounded-r-[6px] rounded-tr-[3px] bg-lp-gold" />
    </span>
  );
}

const BADGE_TONE = {
  hot: "bg-lp-gold text-lp-navy-deep",
  warn: "bg-lp-gold-band text-lp-navy-deep",
  quiet: "bg-white/[.14] text-white",
} as const;

export function RailRow({
  item,
  active,
  label,
  count,
  onNavigate,
}: {
  item: AdminNavItem;
  active: boolean;
  label: string;
  count: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center justify-between gap-2 rounded-[9px] px-3 text-[.9rem] font-semibold transition-colors",
        active ? "bg-white/[.12] text-white" : "text-lp-on-navy hover:bg-white/[.08]",
      )}
    >
      <span className="flex min-w-0 items-center gap-[11px]">
        {/* A dot, not the icon, at rest: fifteen icons in one column read as
            noise, and the dot is what carries the active state. */}
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            active ? "bg-lp-gold" : "bg-lp-on-navy-faint",
          )}
        />
        <span className="truncate">{label}</span>
      </span>
      {count > 0 && (
        <span
          className={cn(
            "min-w-5 shrink-0 rounded-full px-[7px] py-0.5 text-center text-[.74rem] font-extrabold tabular-nums",
            BADGE_TONE[item.badgeTone ?? "quiet"],
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

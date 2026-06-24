"use client";

import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/admin/user-avatar";

/**
 * Student dashboard top nav (desktop). Sits below the shared site header and
 * gives the dashboard its own Home / My Courses / Certificates rail plus the
 * profile + settings (and staff) shortcuts. Mobile uses DashboardTabs instead.
 */
export function DashboardNav({
  userId,
  userName,
  hasAvatar,
  staff,
}: {
  userId: string;
  userName: string;
  hasAvatar: boolean;
  staff: { href: string; label: string } | null;
}) {
  const t = useTranslations("Student");
  const pathname = usePathname();

  const items = [
    { href: "/dashboard", label: t("navHome") },
    { href: "/dashboard/courses", label: t("navCourses") },
    { href: "/dashboard/certificates", label: t("navCertificates") },
  ];
  const active = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line">
      <nav className="hidden gap-1 sm:flex">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active(i.href)
                ? "border-navy-800 text-navy-800"
                : "border-transparent text-slate-500 hover:text-navy-600",
            )}
          >
            {i.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3 py-2">
        {staff && (
          <Link
            href={staff.href}
            className="rounded-md px-2 py-1 text-xs font-medium text-navy-700 ring-1 ring-line hover:bg-navy-100"
          >
            {staff.label}
          </Link>
        )}
        <Link
          href="/dashboard/profile"
          className="hidden max-w-[14rem] items-center gap-2 sm:flex"
        >
          <UserAvatar
            name={userName}
            email={null}
            src={hasAvatar ? `/api/avatars/${userId}` : null}
            className="size-7"
          />
          <span className="truncate text-sm font-medium text-ink hover:text-navy-600">
            {userName}
          </span>
        </Link>
        <Link
          href="/dashboard/settings"
          className="text-slate-500 hover:text-navy-600"
          aria-label={t("navSettings")}
        >
          <Settings className="size-4" />
        </Link>
      </div>
    </div>
  );
}

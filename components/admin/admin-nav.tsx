"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Admin section nav. Finance is visible to accountants; user/course management
 * is super_admin only (gated by `canManage`, and re-checked server-side).
 *
 * A sidebar from `lg` up: thirteen sections no longer fit on one line, and a
 * row that wraps onto two reads as two unrelated groups. Below `lg` it becomes
 * a single horizontally scrollable strip rather than wrapping, for the same
 * reason.
 */
export function AdminNav({ canManage }: { canManage: boolean }) {
  const t = useTranslations("Admin");
  const pathname = usePathname();

  const items = [
    { href: "/admin", label: t("navDashboard"), show: true },
    { href: "/admin/courses", label: t("navCourses"), show: canManage },
    { href: "/admin/users", label: t("navUsers"), show: canManage },
    { href: "/admin/enrollments", label: t("navEnrollments"), show: canManage },
    { href: "/admin/messages", label: t("navMessages"), show: canManage },
    { href: "/admin/payments", label: t("navPayments"), show: true },
    { href: "/admin/quizzes", label: t("navQuizzes"), show: canManage },
    { href: "/admin/module-tests", label: t("navModuleTests"), show: canManage },
    { href: "/admin/certificates", label: t("navCertificates"), show: canManage },
    { href: "/admin/analytics", label: t("navAnalytics"), show: true },
    { href: "/admin/audience", label: t("navAudience"), show: true },
    { href: "/admin/notifications", label: t("navNotifications"), show: canManage },
    { href: "/admin/audit", label: t("navAudit"), show: canManage },
  ].filter((i) => i.show);

  return (
    <nav
      aria-label={t("title")}
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 pb-px lg:mx-0 lg:flex-col lg:overflow-visible lg:border-b-0 lg:px-0 lg:pb-0"
    >
      {items.map((i) => {
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 shrink-0 items-center whitespace-nowrap px-3 text-sm font-medium transition-colors",
              // Horizontal strip: underline. Sidebar: filled row with a left rule.
              "border-b-2 lg:rounded-md lg:border-b-0 lg:border-l-2 lg:px-3",
              active
                ? "border-navy-800 text-navy-800 lg:bg-navy-50"
                : "border-transparent text-slate-500 hover:text-navy-600 lg:hover:bg-slate-50",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

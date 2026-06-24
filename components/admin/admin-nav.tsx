"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Admin section nav. Finance is visible to accountants; user/course management
 * is super_admin only (gated by `canManage`, and re-checked server-side).
 */
export function AdminNav({ canManage }: { canManage: boolean }) {
  const t = useTranslations("Admin");
  const pathname = usePathname();

  const items = [
    { href: "/admin", label: t("navDashboard"), show: true },
    { href: "/admin/courses", label: t("navCourses"), show: canManage },
    { href: "/admin/users", label: t("navUsers"), show: canManage },
    { href: "/admin/enrollments", label: t("navEnrollments"), show: canManage },
    { href: "/admin/payments", label: t("navPayments"), show: true },
    { href: "/admin/quizzes", label: t("navQuizzes"), show: canManage },
    { href: "/admin/module-tests", label: t("navModuleTests"), show: canManage },
    { href: "/admin/certificates", label: t("navCertificates"), show: canManage },
    { href: "/admin/analytics", label: t("navAnalytics"), show: true },
  ].filter((i) => i.show);

  return (
    <nav className="flex flex-wrap gap-1 border-b border-line">
      {items.map((i) => {
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-navy-800 text-navy-800"
                : "border-transparent text-slate-500 hover:text-navy-600",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

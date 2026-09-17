"use client";

import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  ClipboardList,
  CreditCard,
  FileCheck,
  LayoutDashboard,
  MessageSquare,
  ScrollText,
  Send,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Admin section nav. Finance is visible to accountants; user/course management
 * is super_admin only (gated by `canManage`, and re-checked server-side).
 *
 * Thirteen destinations are too many for a flat list to scan, so they are
 * grouped by the job someone came to do — run the school, handle money, grade,
 * look at numbers, keep the system honest — with the group as a quiet label.
 * The active row is a solid navy pill: readable at a glance from across the
 * page, and the same shape the primary buttons use elsewhere.
 */
export function AdminNav({ canManage }: { canManage: boolean }) {
  const t = useTranslations("Admin");
  const pathname = usePathname();

  type Item = { href: string; label: string; icon: LucideIcon; show: boolean };
  const groups: { label: string; items: Item[] }[] = [
    {
      label: t("navGroupManage"),
      items: [
        { href: "/admin", label: t("navDashboard"), icon: LayoutDashboard, show: true },
        { href: "/admin/courses", label: t("navCourses"), icon: BookOpen, show: canManage },
        { href: "/admin/users", label: t("navUsers"), icon: Users, show: canManage },
        { href: "/admin/enrollments", label: t("navEnrollments"), icon: UserPlus, show: canManage },
        { href: "/admin/messages", label: t("navMessages"), icon: MessageSquare, show: canManage },
      ],
    },
    {
      label: t("navGroupFinance"),
      items: [
        { href: "/admin/payments", label: t("navPayments"), icon: CreditCard, show: true },
      ],
    },
    {
      label: t("navGroupAssess"),
      items: [
        { href: "/admin/quizzes", label: t("navQuizzes"), icon: ClipboardList, show: canManage },
        { href: "/admin/module-tests", label: t("navModuleTests"), icon: FileCheck, show: canManage },
        { href: "/admin/certificates", label: t("navCertificates"), icon: Award, show: canManage },
      ],
    },
    {
      label: t("navGroupInsight"),
      items: [
        { href: "/admin/analytics", label: t("navAnalytics"), icon: BarChart3, show: true },
        { href: "/admin/audience", label: t("navAudience"), icon: Activity, show: true },
      ],
    },
    {
      label: t("navGroupSystem"),
      items: [
        { href: "/admin/notifications", label: t("navNotifications"), icon: Send, show: canManage },
        { href: "/admin/audit", label: t("navAudit"), icon: ScrollText, show: canManage },
      ],
    },
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => i.show) }))
    .filter((g) => g.items.length > 0);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav aria-label={t("title")}>
      {/* Below lg: one scrollable strip, icons only carry the meaning inline. */}
      <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 lg:hidden">
        {groups.flatMap((g) => g.items).map((i) => {
          const active = isActive(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium",
                active
                  ? "border-navy-800 text-navy-800"
                  : "border-transparent text-slate-500 hover:text-navy-600",
              )}
            >
              <i.icon className="size-4" aria-hidden />
              {i.label}
            </Link>
          );
        })}
      </div>

      {/* lg and up: grouped sidebar in a panel. */}
      <div className="hidden rounded-xl border border-line bg-surface p-3 shadow-sm lg:block">
        {groups.map((g, gi) => (
          <div key={g.label} className={cn(gi > 0 && "mt-4")}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {g.label}
            </p>
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const active = isActive(i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-navy-800 text-white shadow-sm"
                          : "text-slate-600 hover:bg-navy-100 hover:text-navy-800",
                      )}
                    >
                      <i.icon
                        className={cn("size-4 shrink-0", active ? "text-gold-400" : "text-slate-400")}
                        aria-hidden
                      />
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

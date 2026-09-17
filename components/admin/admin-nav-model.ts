import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  ClipboardList,
  CreditCard,
  FileCheck,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  ScrollText,
  Send,
  UserPlus,
  Users,
} from "lucide-react";

/**
 * The admin destinations, in the five groups the design names.
 *
 * Shared by the desktop rail and the mobile drawer so the two can never drift,
 * and kept free of React so a server component can read it too.
 *
 * `manage` mirrors the server-side guard: an accountant sees finance and the
 * numbers, not the school's operations. Hiding a row is a courtesy — every
 * route re-checks the role itself.
 *
 * `badgeKey` names the count that belongs on the row. Counts come from one
 * server call and are threaded in, so the nav never queries anything.
 */
export type AdminBadgeKey = "applications" | "questions" | "payments" | "certificates";

export type AdminNavItem = {
  href: string;
  /** Key in the `Admin` message namespace. */
  labelKey: string;
  icon: LucideIcon;
  manage: boolean;
  badgeKey?: AdminBadgeKey;
  /** How the badge reads: gold demands action, amber warns, grey informs. */
  badgeTone?: "hot" | "warn" | "quiet";
};

export type AdminNavGroup = { labelKey: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    labelKey: "navGroupManage",
    items: [
      { href: "/admin", labelKey: "navDashboard", icon: LayoutDashboard, manage: false },
      {
        href: "/admin/applications",
        labelKey: "navApplications",
        icon: Inbox,
        manage: true,
        badgeKey: "applications",
        badgeTone: "hot",
      },
      { href: "/admin/courses", labelKey: "navCourses", icon: BookOpen, manage: true },
      { href: "/admin/users", labelKey: "navUsers", icon: Users, manage: true },
      { href: "/admin/enrollments", labelKey: "navEnrollments", icon: UserPlus, manage: true },
      {
        href: "/admin/messages",
        labelKey: "navMessages",
        icon: MessageSquare,
        manage: true,
        badgeKey: "questions",
        badgeTone: "quiet",
      },
    ],
  },
  {
    labelKey: "navGroupFinance",
    items: [
      {
        href: "/admin/payments",
        labelKey: "navPayments",
        icon: CreditCard,
        manage: false,
        badgeKey: "payments",
        badgeTone: "warn",
      },
    ],
  },
  {
    labelKey: "navGroupAssess",
    items: [
      { href: "/admin/quizzes", labelKey: "navQuizzes", icon: ClipboardList, manage: true },
      { href: "/admin/module-tests", labelKey: "navModuleTests", icon: FileCheck, manage: true },
      {
        href: "/admin/certificates",
        labelKey: "navCertificates",
        icon: Award,
        manage: true,
        badgeKey: "certificates",
        badgeTone: "quiet",
      },
    ],
  },
  {
    labelKey: "navGroupInsight",
    items: [
      { href: "/admin/analytics", labelKey: "navAnalytics", icon: BarChart3, manage: false },
      { href: "/admin/audience", labelKey: "navAudience", icon: Activity, manage: false },
    ],
  },
  {
    labelKey: "navGroupSystem",
    items: [
      { href: "/admin/notifications", labelKey: "navNotifications", icon: Send, manage: true },
      { href: "/admin/audit", labelKey: "navAudit", icon: ScrollText, manage: true },
    ],
  },
];

/** The counts that ride on the nav rows. */
export type AdminNavBadges = Partial<Record<AdminBadgeKey, number>>;

/** Drop what this role may not see, then drop any group left empty. */
export function visibleGroups(canManage: boolean): AdminNavGroup[] {
  return ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => canManage || !i.manage),
  })).filter((g) => g.items.length > 0);
}

/**
 * `/admin` matches only itself — every other row would light up under it.
 */
export function isAdminNavActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

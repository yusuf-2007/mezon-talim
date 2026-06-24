import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { DashboardNav } from "@/components/student/dashboard-nav";
import { DashboardTabs } from "@/components/student/dashboard-tabs";

/**
 * Student dashboard shell — wraps only /dashboard/* (the player and exams keep
 * their own focused shells). Desktop gets a top nav rail; mobile gets a fixed
 * bottom-tab bar. Staff see a shortcut into Studio/Admin.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const t = await getTranslations("Student");

  const staff =
    user.role === "super_admin" || user.role === "accountant"
      ? { href: "/admin", label: t("navAdmin") }
      : user.role === "teacher"
        ? { href: "/studio", label: t("navStudio") }
        : null;
  const name = user.fullName || user.email || user.phone || "—";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6 sm:pb-8">
      <DashboardNav userName={name} staff={staff} />
      <div className="mt-8">{children}</div>
      <DashboardTabs />
    </div>
  );
}

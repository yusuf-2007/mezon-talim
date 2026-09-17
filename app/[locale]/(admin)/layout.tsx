import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getAdminNavBadges } from "@/lib/admin/dashboard";
import { AdminRail } from "@/components/admin/admin-rail";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";

/**
 * Admin + finance area — super admins and accountants only.
 *
 * The navy rail from `lg` up, a top bar with a grouped drawer below it. Same
 * shell as the student dashboard so staff and students read as one product,
 * and like that one it drops the site header: the rail already carries the
 * identity, and two headers stacked was the bug the student side had.
 *
 * Counts for the nav badges are fetched once here, not per row.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("super_admin", "accountant");
  const t = await getTranslations("Admin");
  const canManage = user.role === "super_admin";
  const badges = await getAdminNavBadges(canManage);

  const name = user.fullName || user.email || user.phone || "—";
  const navProps = {
    name,
    roleLabel: canManage ? t("roleSuperAdmin") : t("roleAccountant"),
    initials: initialsOf(name),
    canManage,
    badges,
  };

  return (
    <div className="grid min-h-screen bg-lp-wash-alt font-lp-body lg:grid-cols-[244px_1fr]">
      <AdminRail {...navProps} />
      <AdminMobileNav {...navProps} />
      <main className="min-w-0 px-5 pb-16 pt-6 sm:px-8 lg:px-9 lg:pt-6">
        <div className="mx-auto max-w-[1240px]">{children}</div>
      </main>
    </div>
  );
}

/** Up to two letters from the name, for the rail's avatar circle. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  const letters = parts.slice(0, 2).map((p) => p[0] ?? "");
  return letters.join("").toUpperCase();
}

import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { AdminNav } from "@/components/admin/admin-nav";

/** Admin + finance area — super admins and accountants only. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("super_admin", "accountant");
  const t = await getTranslations("Admin");
  const canManage = user.role === "super_admin";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/admin" className="font-heading text-xl font-semibold text-navy-800">
          {t("title")}
        </Link>
        <LogoutButton />
      </div>
      <div className="mt-4">
        <AdminNav canManage={canManage} />
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}

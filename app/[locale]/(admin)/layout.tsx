import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { SiteShell } from "@/components/site-shell";

/**
 * Admin + finance area — super admins and accountants only.
 *
 * Sidebar layout from `lg` up. The section list outgrew a single row, and a
 * sidebar also gives every page the same left edge to hang its title from.
 * The site header already carries the log-out control, so this shell no
 * longer repeats it.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("super_admin", "accountant");
  const t = await getTranslations("Admin");
  const canManage = user.role === "super_admin";

  return (
    <SiteShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[13.5rem_1fr] lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Link
            href="/admin"
            className="block font-heading text-xl font-semibold text-navy-800"
          >
            {t("title")}
          </Link>
          <div className="mt-4">
            <AdminNav canManage={canManage} />
          </div>
        </aside>
        <div className="mt-8 min-w-0 lg:mt-0">{children}</div>
      </div>
    </SiteShell>
  );
}

import { getLocale, getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleSelect } from "@/components/admin/role-select";
import { StatCard } from "@/components/admin/stat-card";
import { UserAvatar } from "@/components/admin/user-avatar";
import type { Locale } from "@/lib/i18n/routing";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const { q } = await searchParams;

  const [users, roleCounts] = await Promise.all([
    usersRepository.listAll({ search: q, limit: 200 }),
    usersRepository.countByRole(),
  ]);
  const countFor = (...roles: string[]) =>
    roleCounts.filter((r) => roles.includes(r.role)).reduce((n, r) => n + r.count, 0);
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold text-navy-800">
          {t("usersTitle")}
        </h1>
        <form className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder={t("searchUsers")}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm"
          />
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("statTotalUsers")} value={String(countFor("student", "teacher", "accountant", "super_admin"))} />
        <StatCard label={t("statAdmins")} value={String(countFor("super_admin", "accountant"))} />
        <StatCard label={t("statStudents")} value={String(countFor("student"))} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">{t("colName")}</th>
              <th className="px-4 py-3 font-medium">{t("colRole")}</th>
              <th className="px-4 py-3 font-medium">{t("colCourses")}</th>
              <th className="px-4 py-3 font-medium">{t("colRegistered")}</th>
              <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {t("noUsers")}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={u.fullName}
                        email={u.email}
                        src={u.hasAvatar ? `/api/avatars/${u.id}` : null}
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="block truncate font-medium text-ink hover:text-navy-600"
                        >
                          {u.fullName || "—"}
                        </Link>
                        <p className="truncate text-xs text-slate-500">
                          {u.email || u.phone || "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleSelect userId={u.id} role={u.role} disabled={u.id === actor.id} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {t("coursesCount", { count: u.enrollmentCount })}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">
                    {fmtDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <Badge className="bg-success/10 text-success">{t("statusActive")}</Badge>
                    ) : (
                      <Badge className="bg-line text-slate-500">{t("statusInactive")}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      render={<Link href={`/admin/users/${u.id}`} />}
                      variant="ghost"
                      size="sm"
                      className="text-navy-600"
                    >
                      <Pencil className="size-3.5" />
                      {t("edit")}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{t("usersHint")}</p>
    </div>
  );
}

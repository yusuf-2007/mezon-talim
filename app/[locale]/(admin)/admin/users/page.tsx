import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { Link } from "@/lib/i18n/navigation";
import { RoleSelect } from "@/components/admin/role-select";
import { StatCard } from "@/components/admin/stat-card";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const { q } = await searchParams;

  const [users, roleCounts] = await Promise.all([
    usersRepository.listAll({ search: q, limit: 200 }),
    usersRepository.countByRole(),
  ]);
  const countFor = (...roles: string[]) =>
    roleCounts.filter((r) => roles.includes(r.role)).reduce((n, r) => n + r.count, 0);

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
              <th className="px-4 py-3 font-medium">{t("colContact")}</th>
              <th className="px-4 py-3 font-medium">{t("colRole")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  {t("noUsers")}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="font-medium text-ink hover:text-navy-600"
                    >
                      {u.fullName || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {u.email || u.phone || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <RoleSelect
                      userId={u.id}
                      role={u.role}
                      disabled={u.id === actor.id}
                    />
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

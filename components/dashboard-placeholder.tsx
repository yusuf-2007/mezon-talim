import { getTranslations } from "next-intl/server";
import type { SessionUser } from "@/lib/auth/types";
import { LogoutButton } from "@/components/auth/logout-button";

/**
 * Minimal authenticated panel used by the Phase 2 role-gated areas
 * (student / studio / admin). Real dashboards arrive in later phases.
 */
export async function DashboardPlaceholder({
  title,
  subtitle,
  user,
}: {
  title: string;
  subtitle: string;
  user: SessionUser;
}) {
  const t = await getTranslations("Account");

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-navy-800">
            {title}
          </h1>
          <p className="mt-1 text-slate-500">{subtitle}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-8 rounded-xl border border-line bg-surface p-6 shadow-sm">
        <p className="mb-4 font-medium text-navy-800">
          {user.fullName ?? user.email ?? user.phone}
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">{t("role")}</dt>
            <dd className="mt-0.5 inline-flex rounded-full bg-navy-100 px-2 py-0.5 font-medium text-navy-800">
              {user.role}
            </dd>
          </div>
          {user.email && (
            <div>
              <dt className="text-slate-500">{t("email")}</dt>
              <dd className="mt-0.5 text-ink">{user.email}</dd>
            </div>
          )}
          {user.phone && (
            <div>
              <dt className="text-slate-500">{t("phone")}</dt>
              <dd className="mt-0.5 text-ink">{user.phone}</dd>
            </div>
          )}
        </dl>
      </div>

      <p className="mt-6 text-sm text-slate-500">{t("comingSoon")}</p>
    </section>
  );
}

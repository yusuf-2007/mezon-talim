import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { analyticsRepository } from "@/lib/db/repositories/analytics";
import { formatTiyin } from "@/lib/payments";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { StatCard } from "@/components/admin/stat-card";
import { RevenueBars } from "@/components/admin/revenue-bars";
import type { Locale } from "@/lib/i18n/routing";

export default async function AdminDashboardPage() {
  await requireRole("super_admin", "accountant");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;

  const [overview, revenueByDay, recentSales, topCourses] = await Promise.all([
    analyticsRepository.overview(),
    analyticsRepository.revenueByDay(30),
    analyticsRepository.recentSales(8),
    analyticsRepository.topCourses(5),
  ]);

  return (
    <div className="space-y-10">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("kpiRevenue")}
          value={formatTiyin(overview.totalRevenueTiyin, locale)}
          sub={t("kpiRevenueSub", { count: overview.paidCount })}
        />
        <StatCard
          label={t("kpiEnrollments")}
          value={String(overview.enrollmentTotal)}
          sub={t("kpiEnrollmentsSub", { count: overview.activeEnrollments })}
        />
        <StatCard
          label={t("kpiUsers")}
          value={String(overview.userTotal)}
          sub={t("kpiUsersSub", { count: overview.studentTotal })}
        />
        <StatCard
          label={t("kpiCompletion")}
          value={`${overview.completionRatePct}%`}
          sub={t("kpiCompletionSub", { count: overview.certificateTotal })}
        />
      </div>

      {/* Revenue chart */}
      <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-navy-800">
          {t("revenue30d")}
        </h2>
        <div className="mt-4">
          <RevenueBars data={revenueByDay} locale={locale} emptyLabel={t("noSales")} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent sales */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-navy-800">
            {t("recentSales")}
          </h2>
          {recentSales.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t("noSales")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line text-sm">
              {recentSales.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {s.userName || s.userEmail || "—"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {pickLocale(s.courseTitle, locale)}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums text-navy-700">
                    {formatTiyin(s.amountTiyin, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Top courses */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-navy-800">
            {t("topCourses")}
          </h2>
          {topCourses.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t("noData")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line text-sm">
              {topCourses.map((c) => (
                <li key={c.courseId} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    href={`/studio/courses/${c.courseId}`}
                    className="min-w-0 truncate text-ink hover:text-navy-600"
                  >
                    {pickLocale(c.title, locale)}
                  </Link>
                  <span className="shrink-0 text-slate-500 tabular-nums">
                    {t("enrollCount", { count: c.enrollments })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

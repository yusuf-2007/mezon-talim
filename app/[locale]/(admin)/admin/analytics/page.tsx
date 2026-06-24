import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { analyticsRepository } from "@/lib/db/repositories/analytics";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { StatCard } from "@/components/admin/stat-card";
import { CountBars } from "@/components/admin/count-bars";
import type { Locale } from "@/lib/i18n/routing";

export default async function AdminAnalyticsPage() {
  await requireRole("super_admin", "accountant");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;

  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString(locale === "ru" ? "ru-RU" : "uz-UZ");

  const [overview, growth, enrollmentsByDay, topCourses, newUsers, recentEnrollments] =
    await Promise.all([
      analyticsRepository.overview(),
      analyticsRepository.growth(30),
      analyticsRepository.enrollmentsByDay(30),
      analyticsRepository.topCourses(5),
      analyticsRepository.newUsers(5),
      analyticsRepository.recentEnrollments(7),
    ]);

  return (
    <div className="space-y-10">
      <h1 className="font-heading text-2xl font-semibold text-navy-800">
        {t("analyticsTitle")}
      </h1>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("kpiUsers")}
          value={String(overview.userTotal)}
          sub={t("new30d", { count: growth.newUsers })}
        />
        <StatCard
          label={t("kpiEnrollments")}
          value={String(overview.enrollmentTotal)}
          sub={t("new30d", { count: growth.newEnrollments })}
        />
        <StatCard
          label={t("publishedCoursesLabel")}
          value={String(overview.publishedCourses)}
        />
        <StatCard
          label={t("kpiCompletion")}
          value={`${overview.completionRatePct}%`}
          sub={t("kpiCompletionSub", { count: overview.certificateTotal })}
        />
      </div>

      {/* Enrollment chart */}
      <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-navy-800">
          {t("enrollments30d")}
        </h2>
        <div className="mt-4">
          <CountBars data={enrollmentsByDay} emptyLabel={t("noData")} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
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
                    href={`/admin/courses/${c.courseId}`}
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

        {/* Recent enrollments */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-navy-800">
            {t("recentEnrollmentsTitle")}
          </h2>
          {recentEnrollments.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t("noData")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line text-sm">
              {recentEnrollments.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {e.userName || e.userEmail || "—"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {pickLocale(e.courseTitle, locale)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                    {fmtDate(e.startedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* New users */}
      <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-navy-800">
          {t("newUsersTitle")}
        </h2>
        {newUsers.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{t("noData")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line text-sm">
            {newUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {u.fullName || u.email || "—"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{t(`role_${u.role}`)}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                  {fmtDate(u.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

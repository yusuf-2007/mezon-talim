import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { analyticsRepository } from "@/lib/db/repositories/analytics";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { CountBars } from "@/components/admin/count-bars";
import { CourseFilter } from "@/components/admin/course-filter";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Banner, Card, CardHead, Empty, KpiStrip } from "@/components/admin/ui";
import type { Locale } from "@/lib/i18n/routing";

/**
 * The numbers, arranged as a story about where people stop.
 *
 * The funnel and the per-lesson drop-off are the two views that say something
 * actionable; the totals above them are context. Visible to accountants, who
 * need the same picture finance does.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const me = await requireRole("super_admin", "accountant");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const { courseId } = await searchParams;

  const [overview, growth, enrollmentsByDay, funnel, courses, topCourses] =
    await Promise.all([
      analyticsRepository.overview(),
      analyticsRepository.growth(30),
      analyticsRepository.enrollmentsByDay(30),
      analyticsRepository.funnel(),
      coursesRepository.listAll(),
      analyticsRepository.topCourses(5),
    ]);

  const selected = courseId ?? courses[0]?.id;
  const dropOff = selected
    ? await analyticsRepository.lessonDropOff(selected)
    : [];
  const peakStarted = Math.max(1, ...dropOff.map((l) => Number(l.started)));

  // The steepest consecutive fall is the one worth naming in words.
  const cliff = dropOff.reduce<{ index: number; drop: number }>(
    (worst, l, i) => {
      if (i === 0) return worst;
      const prev = Number(dropOff[i - 1]!.started);
      const now = Number(l.started);
      const drop = prev > 0 ? (prev - now) / prev : 0;
      return drop > worst.drop ? { index: i, drop } : worst;
    },
    { index: -1, drop: 0 },
  );

  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navAnalytics")}
        title={t("analyticsTitle")}
        userId={me.id}
        role={me.role}
      />

      <div className="mb-[18px]">
        <KpiStrip
          cells={[
            {
              label: t("kpiUsers"),
              value: String(overview.userTotal),
              sub: t("new30d", { count: growth.newUsers }),
            },
            {
              label: t("kpiEnrollments"),
              value: String(overview.enrollmentTotal),
              sub: t("new30d", { count: growth.newEnrollments }),
            },
            {
              label: t("publishedCoursesLabel"),
              value: String(overview.publishedCourses),
            },
            {
              label: t("kpiCompletion"),
              value: `${overview.completionRatePct}%`,
              sub: t("kpiCompletionSub", { count: overview.certificateTotal }),
            },
          ]}
        />
      </div>

      <div className="mb-[18px] grid gap-[18px] xl:grid-cols-[1.2fr_.8fr]">
        {/* ── Funnel ─────────────────────────────────────────────────── */}
        <Card>
          <CardHead eyebrow={t("funnelEyebrow")} title={t("funnelTitle")} />
          <div className="space-y-3 px-6 py-5">
            {funnel.map((f, i) => {
              const prev = i > 0 ? funnel[i - 1]!.count : null;
              const conv =
                prev && prev > 0 ? Math.round((f.count / prev) * 100) : null;
              return (
                <div
                  key={f.step}
                  className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3"
                >
                  <span className="truncate text-[.84rem] font-semibold text-lp-slate">
                    {t(`funnel_${f.step}`)}
                  </span>
                  <span className="block h-2.5 overflow-hidden rounded-full bg-lp-line-soft">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        f.step === "certified" ? "bg-lp-gold" : "bg-lp-navy",
                      )}
                      style={{ width: `${(f.count / funnelMax) * 100}%` }}
                    />
                  </span>
                  <span className="text-right text-[.84rem] font-bold text-lp-ink tabular-nums">
                    {f.count}
                    {conv != null && (
                      <span className="ml-1 font-semibold text-lp-muted">
                        {conv}%
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-lp-line-soft bg-lp-wash-alt px-6 py-4">
            {/* Say what is missing rather than draw a step we cannot measure. */}
            <p className="text-[.8rem] text-lp-muted">
              {t("funnelVisitsNote")}
            </p>
          </div>
        </Card>

        <Card>
          <CardHead title={t("enrollments30d")} />
          <div className="px-6 py-5">
            <CountBars data={enrollmentsByDay} emptyLabel={t("noData")} />
          </div>
        </Card>
      </div>

      {/* ── Lesson drop-off ──────────────────────────────────────────── */}
      <Card>
        <CardHead
          eyebrow={t("dropOffEyebrow")}
          title={t("dropOffTitle")}
          right={
            <CourseFilter
              courses={courses.map((c) => ({
                id: c.id,
                label: pickLocale(c.title, locale),
              }))}
              current={selected ?? ""}
              placeholder={t("enrollmentsSelectCourse")}
            />
          }
        />

        {dropOff.length === 0 ? (
          <Empty>{t("noData")}</Empty>
        ) : (
          <>
            {cliff.index > 0 && cliff.drop >= 0.25 && (
              <div className="px-6 pt-5">
                <Banner tone="warn">
                  {t("dropOffCliff", {
                    from: cliff.index,
                    to: cliff.index + 1,
                    pct: Math.round(cliff.drop * 100),
                  })}
                </Banner>
              </div>
            )}
            <div className="flex items-end gap-1.5 overflow-x-auto px-6 pb-3 pt-5">
              {dropOff.map((l, i) => (
                <div
                  key={l.lessonId}
                  className="flex w-full min-w-8 flex-col items-center gap-2"
                >
                  <span
                    title={pickLocale(l.title, locale)}
                    className={cn(
                      "block w-full rounded-t-[4px]",
                      i === cliff.index ? "bg-lp-gold" : "bg-lp-navy",
                    )}
                    style={{
                      height: `${Math.max(4, (Number(l.started) / peakStarted) * 120)}px`,
                    }}
                  />
                  <span className="text-[.74rem] font-semibold text-lp-muted tabular-nums">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-lp-line-soft bg-lp-wash-alt px-6 py-4">
              <p className="text-[.8rem] text-lp-muted">{t("dropOffNote")}</p>
            </div>
          </>
        )}
      </Card>

      <div className="mt-[18px]">
        <Card>
          <CardHead title={t("topCourses")} right={<span />} />
          <ul>
            {topCourses.map((c) => (
              <li
                key={c.courseId}
                className="flex items-center justify-between gap-4 border-b border-lp-line-soft px-6 py-3.5 last:border-b-0"
              >
                <Link
                  href={`/admin/courses/${c.courseId}`}
                  className="min-w-0 truncate text-[.9rem] font-semibold text-lp-ink hover:text-lp-navy-mid"
                >
                  {pickLocale(c.title, locale)}
                </Link>
                <span className="shrink-0 text-[.82rem] text-lp-muted tabular-nums">
                  {t("enrollCount", { count: c.enrollments })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

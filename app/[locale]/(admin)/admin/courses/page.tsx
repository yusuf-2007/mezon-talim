import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { analyticsRepository } from "@/lib/db/repositories/analytics";
import { formatTiyin } from "@/lib/payments";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { CourseStatusSelect } from "@/components/admin/course-status-select";
import type { Locale } from "@/lib/i18n/routing";

export default async function AdminCoursesPage() {
  await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;

  const courses = await analyticsRepository.allCoursesWithStats();

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-navy-800">
        {t("coursesTitle")}
      </h1>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">{t("colCourse")}</th>
              <th className="px-4 py-3 font-medium tabular-nums">{t("colEnrollments")}</th>
              <th className="px-4 py-3 font-medium tabular-nums">{t("colRevenue")}</th>
              <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {courses.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  {t("noData")}
                </td>
              </tr>
            ) : (
              courses.map((c) => (
                <tr key={c.courseId}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/studio/courses/${c.courseId}`}
                      className="font-medium text-ink hover:text-navy-600"
                    >
                      {pickLocale(c.title, locale)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{c.enrollments}</td>
                  <td className="px-4 py-3 tabular-nums text-navy-700">
                    {formatTiyin(c.revenueTiyin, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <CourseStatusSelect courseId={c.courseId} status={c.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

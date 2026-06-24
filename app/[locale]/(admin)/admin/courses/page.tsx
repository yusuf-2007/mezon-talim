import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { analyticsRepository } from "@/lib/db/repositories/analytics";
import { deleteCourseAdminAction } from "@/lib/admin/actions";
import { formatTiyin } from "@/lib/payments";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { CourseStatusSelect } from "@/components/admin/course-status-select";
import { ConfirmSubmit } from "@/components/studio/confirm-submit";
import type { Locale } from "@/lib/i18n/routing";

const STATUSES = ["draft", "published", "archived"] as const;

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const { q, status } = await searchParams;

  const all = await analyticsRepository.allCoursesWithStats();
  const query = q?.trim().toLowerCase();
  const courses = all.filter((c) => {
    if (status && status !== "all" && c.status !== status) return false;
    if (query) {
      const title = `${c.title.uz ?? ""} ${c.title.ru ?? ""} ${c.slug}`.toLowerCase();
      if (!title.includes(query)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold text-navy-800">
          {t("coursesTitle")}
        </h1>
        <Button render={<Link href="/admin/courses/new" />}>{t("newCourse")}</Button>
      </div>

      {/* Search + status filter (GET form) */}
      <form className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchCourses")}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? "all"}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
        >
          <option value="all">{t("statusAll")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status_${s}`)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm">
          {t("filter")}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">{t("colCourse")}</th>
              <th className="px-4 py-3 font-medium tabular-nums">{t("colEnrollments")}</th>
              <th className="px-4 py-3 font-medium tabular-nums">{t("colRevenue")}</th>
              <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
              <th className="px-4 py-3 font-medium">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {courses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {t("noData")}
                </td>
              </tr>
            ) : (
              courses.map((c) => (
                <tr key={c.courseId}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/courses/${c.courseId}`}
                      className="font-medium text-ink hover:text-navy-600"
                    >
                      {pickLocale(c.title, locale)}
                    </Link>
                    <p className="text-xs text-slate-500">/{c.slug}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{c.enrollments}</td>
                  <td className="px-4 py-3 tabular-nums text-navy-700">
                    {formatTiyin(c.revenueTiyin, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <CourseStatusSelect courseId={c.courseId} status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/courses/${c.courseId}`}
                        className="text-sm text-navy-600 hover:underline"
                      >
                        {t("edit")}
                      </Link>
                      {c.status === "published" && (
                        <a
                          href={`/${locale}/courses/${c.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-navy-600 hover:underline"
                        >
                          {t("preview")}
                        </a>
                      )}
                      <form action={deleteCourseAdminAction.bind(null, c.courseId)}>
                        <ConfirmSubmit label={t("delete")} />
                      </form>
                    </div>
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

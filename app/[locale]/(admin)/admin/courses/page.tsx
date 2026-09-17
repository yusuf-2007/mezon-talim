import { Plus } from "lucide-react";
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
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  Card,
  CardToolbar,
  FilterChips,
  GhostLink,
  SearchForm,
  Table,
} from "@/components/admin/ui";
import type { Locale } from "@/lib/i18n/routing";

const STATUSES = ["draft", "published", "archived"] as const;

/**
 * Courses as a business list, not an editor.
 *
 * Content is authored in the Studio; what belongs here is the handful of
 * decisions an admin makes about a course once it exists — is it live, what
 * does it cost, is anyone buying it.
 */
export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const me = await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const { q, status } = await searchParams;

  const all = await analyticsRepository.allCoursesWithStats();
  const query = q?.trim().toLowerCase();
  const active = (STATUSES as readonly string[]).includes(status ?? "") ? status! : null;

  const courses = all.filter((c) => {
    if (active && c.status !== active) return false;
    if (query) {
      const hay = `${c.title.uz ?? ""} ${c.title.ru ?? ""} ${c.slug}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const countFor = (s: string) => all.filter((c) => c.status === s).length;

  const href = (s: string | null) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (q) p.set("q", q);
    const qs = p.toString();
    return `/admin/courses${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navCourses")}
        title={t("coursesTitle")}
        userId={me.id}
        role={me.role}
        action={
          <Button
            render={<Link href="/admin/courses/new" />}
            className="bg-lp-gold text-lp-navy-deep shadow-[0_4px_14px_rgba(248,184,1,.28)] hover:bg-lp-gold"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            {t("newCourse")}
          </Button>
        }
      />

      <Card>
        <CardToolbar>
          <FilterChips
            active={active}
            hrefFor={href}
            options={[
              { value: null, label: t("filterAll"), count: all.length },
              ...STATUSES.map((s) => ({
                value: s,
                label: t(`status_${s}`),
                count: countFor(s),
              })),
            ]}
          />
          <SearchForm
            action="/admin/courses"
            defaultValue={q}
            placeholder={t("searchCourses")}
            hidden={{ status: active ?? undefined }}
          />
        </CardToolbar>

        <Table
          empty={t("noData")}
          head={[
            { label: t("colCourse") },
            { label: t("colEnrollments"), align: "right" },
            { label: t("colRevenue"), align: "right" },
            { label: t("colStatus") },
            { label: t("colActions"), align: "right" },
          ]}
          rows={courses.map((c) => [
            <span key="c" className="block min-w-0">
              <Link
                href={`/admin/courses/${c.courseId}`}
                className="block truncate font-semibold text-lp-ink hover:text-lp-navy-mid"
              >
                {pickLocale(c.title, locale)}
              </Link>
              <span className="block truncate font-mono text-[.78rem] text-lp-muted">
                /{c.slug}
              </span>
            </span>,
            <span key="e" className="text-lp-slate">
              {c.enrollments}
            </span>,
            <span key="r" className="font-semibold text-lp-navy">
              {formatTiyin(c.revenueTiyin, locale)}
            </span>,
            <CourseStatusSelect key="s" courseId={c.courseId} status={c.status} />,
            <span key="a" className="flex items-center justify-end gap-3">
              <GhostLink href={`/studio/courses/${c.courseId}`}>{t("studio")}</GhostLink>
              {c.status === "published" && (
                <a
                  href={`/${locale}/courses/${c.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[.84rem] font-bold text-lp-navy-mid hover:underline"
                >
                  {t("preview")}
                </a>
              )}
              <form action={deleteCourseAdminAction.bind(null, c.courseId)}>
                <ConfirmSubmit label={t("delete")} />
              </form>
            </span>,
          ])}
        />

        <div className="border-t border-lp-line-soft bg-lp-wash-alt px-6 py-4">
          <p className="text-[.8rem] text-lp-muted">{t("coursesStudioNote")}</p>
        </div>
      </Card>
    </>
  );
}

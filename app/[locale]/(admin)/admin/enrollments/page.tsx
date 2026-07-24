import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { usersRepository } from "@/lib/db/repositories/users";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { lessonProgressRepository } from "@/lib/db/repositories/lesson-progress";
import { Pencil } from "lucide-react";
import { removeEnrollmentAction } from "@/lib/admin/actions";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/admin/stat-card";
import { UserAvatar } from "@/components/admin/user-avatar";
import { ConfirmSubmit } from "@/components/studio/confirm-submit";
import { CourseFilter } from "@/components/admin/course-filter";
import { EnrollStudentsDialog } from "@/components/admin/enroll-students-dialog";
import type { Locale } from "@/lib/i18n/routing";

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const { courseId } = await searchParams;

  const courses = await coursesRepository.listAll();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold text-navy-800">
          {t("enrollmentsTitle")}
        </h1>
      </div>

      {/* Course selector — applies on selection, no submit button */}
      <CourseFilter
        courses={courses.map((c) => ({
          id: c.id,
          label: pickLocale(c.title, locale),
        }))}
        current={courseId ?? ""}
        placeholder={t("enrollmentsSelectCourse")}
      />

      {!courseId ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-slate-500 shadow-sm">
          {t("selectCourse")}
        </div>
      ) : (
        <CourseRoster courseId={courseId} t={t} courses={courses} locale={locale} />
      )}
    </div>
  );
}

async function CourseRoster({
  courseId,
  t,
  courses,
  locale,
}: {
  courseId: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  courses: Awaited<ReturnType<typeof coursesRepository.listAll>>;
  locale: Locale;
}) {
  const [roster, lessons, allUsers] = await Promise.all([
    enrollmentsRepository.listByCourseWithUser(courseId),
    lessonsRepository.listByCourse(courseId),
    usersRepository.listAll(),
  ]);

  const totalLessons = lessons.length;
  const lessonIds = lessons.map((r) => r.lesson.id);
  const completedRows =
    lessonIds.length > 0
      ? await lessonProgressRepository.completedCountsForLessons(lessonIds)
      : [];
  const completedByUser = new Map<string, number>(
    completedRows.map((r) => [r.userId, r.completed]),
  );

  const enrolledIds = new Set(roster.map((r) => r.user.id));
  const candidates = allUsers
    .filter((u) => !enrolledIds.has(u.id))
    .map((u) => ({ id: u.id, label: `${u.fullName} (${u.email})` }));

  const course = courses.find((c) => c.id === courseId);
  const courseTitle = course ? pickLocale(course.title, locale) : "";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t("colCourse")} value={courseTitle} />
        <StatCard label={t("statEnrolled")} value={String(roster.length)} />
        <StatCard label={t("statLessons")} value={String(totalLessons)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-navy-800">
          {t("addStudents")}
        </h2>
        <EnrollStudentsDialog courseId={courseId} users={candidates} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">{t("colStudent")}</th>
              <th className="px-4 py-3 font-medium">{t("colProgress")}</th>
              <th className="px-4 py-3 font-medium">{t("colEnrollStatus")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {roster.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  {t("noRoster")}
                </td>
              </tr>
            ) : (
              roster.map(({ enrollment, user, hasAvatar }) => {
                const completed = completedByUser.get(user.id) ?? 0;
                const pct =
                  totalLessons > 0
                    ? Math.round((completed / totalLessons) * 100)
                    : 0;
                const statusLabel =
                  pct >= 100
                    ? t("completedLabel")
                    : pct <= 0
                      ? t("notStarted")
                      : t("inProgressLabel");
                return (
                  <tr key={enrollment.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={user.fullName}
                          email={user.email}
                          src={hasAvatar ? `/api/avatars/${user.id}` : null}
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="block truncate font-medium text-ink hover:text-navy-600"
                          >
                            {user.fullName || "—"}
                          </Link>
                          <p className="truncate text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full max-w-[160px] overflow-hidden rounded-full bg-navy-100">
                          <div
                            className="h-full rounded-full bg-success"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="shrink-0 tabular-nums text-slate-600">
                          {pct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-ink">{statusLabel}</span>
                      <span className="ml-1 text-xs text-slate-400">
                        ({enrollment.status})
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          render={<Link href={`/admin/users/${user.id}`} />}
                          variant="ghost"
                          size="sm"
                          className="text-navy-600"
                        >
                          <Pencil className="size-3.5" />
                          {t("edit")}
                        </Button>
                        <form
                          action={removeEnrollmentAction.bind(null, user.id, courseId)}
                        >
                          <ConfirmSubmit label={t("remove")} />
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

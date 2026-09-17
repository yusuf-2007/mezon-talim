import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { usersRepository } from "@/lib/db/repositories/users";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { lessonProgressRepository } from "@/lib/db/repositories/lesson-progress";
import { removeEnrollmentAction } from "@/lib/admin/actions";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { UserAvatar } from "@/components/admin/user-avatar";
import { ConfirmSubmit } from "@/components/studio/confirm-submit";
import { CourseFilter } from "@/components/admin/course-filter";
import { EnrollStudentsDialog } from "@/components/admin/enroll-students-dialog";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  Bar,
  Card,
  CardToolbar,
  Empty,
  GhostLink,
  KpiStrip,
  StatusDot,
  Table,
  type DotTone,
} from "@/components/admin/ui";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Who is on which course, and how far they have got.
 *
 * Scoped to one course at a time rather than listing every enrolment: progress
 * only means anything against a particular curriculum, and "40%" across two
 * courses of different lengths is a number with no referent.
 */
export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const me = await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const { courseId } = await searchParams;

  const courses = await coursesRepository.listAll();

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navEnrollments")}
        title={t("enrollmentsTitle")}
        userId={me.id}
        role={me.role}
      />

      <div className="mb-[18px]">
        <CourseFilter
          courses={courses.map((c) => ({ id: c.id, label: pickLocale(c.title, locale) }))}
          current={courseId ?? ""}
          placeholder={t("enrollmentsSelectCourse")}
        />
      </div>

      {!courseId ? (
        <Card>
          <Empty>{t("selectCourse")}</Empty>
        </Card>
      ) : (
        <CourseRoster courseId={courseId} t={t} courses={courses} locale={locale} />
      )}
    </>
  );
}

async function CourseRoster({
  courseId,
  t,
  courses,
  locale,
}: {
  courseId: string;
  t: Awaited<ReturnType<typeof getTranslations<"Admin">>>;
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
  const completedByUser = new Map(completedRows.map((r) => [r.userId, r.completed]));

  const enrolledIds = new Set(roster.map((r) => r.user.id));
  const candidates = allUsers
    .filter((u) => !enrolledIds.has(u.id))
    .map((u) => ({ id: u.id, label: `${u.fullName} (${u.email})` }));

  const course = courses.find((c) => c.id === courseId);
  const finished = roster.filter(
    ({ user }) => totalLessons > 0 && (completedByUser.get(user.id) ?? 0) >= totalLessons,
  ).length;

  return (
    <>
      <div className="mb-[18px]">
        <KpiStrip
          cells={[
            {
              label: t("colCourse"),
              value: course ? pickLocale(course.title, locale) : "—",
            },
            { label: t("statEnrolled"), value: String(roster.length) },
            { label: t("statLessons"), value: String(totalLessons) },
            { label: t("completedLabel"), value: String(finished), tone: "green" },
          ]}
        />
      </div>

      <Card>
        <CardToolbar>
          <p className="text-[.88rem] font-semibold text-lp-ink">{t("addStudents")}</p>
          <EnrollStudentsDialog courseId={courseId} users={candidates} />
        </CardToolbar>

        <Table
          empty={t("noRoster")}
          head={[
            { label: t("colStudent") },
            { label: t("colProgress") },
            { label: t("colEnrollStatus") },
            { label: t("colActions"), align: "right" },
          ]}
          rows={roster.map(({ enrollment, user, hasAvatar }) => {
            const done = completedByUser.get(user.id) ?? 0;
            const complete = totalLessons > 0 && done >= totalLessons;
            const tone: DotTone = complete ? "green" : done > 0 ? "navy" : "grey";
            const label = complete
              ? t("completedLabel")
              : done > 0
                ? t("inProgressLabel")
                : t("notStarted");
            return [
              <span key="s" className="flex items-center gap-3">
                <UserAvatar
                  name={user.fullName}
                  email={user.email}
                  src={hasAvatar ? `/api/avatars/${user.id}` : null}
                />
                <span className="block min-w-0">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="block truncate font-semibold text-lp-ink hover:text-lp-navy-mid"
                  >
                    {user.fullName || "—"}
                  </Link>
                  <span className="block truncate text-[.8rem] text-lp-muted">
                    {user.email}
                  </span>
                </span>
              </span>,
              <span key="p" className="flex items-center gap-2.5">
                <Bar
                  value={done}
                  max={totalLessons}
                  tone={complete ? "green" : "navy"}
                  className="w-full max-w-[9rem]"
                />
                <span className="shrink-0 text-[.82rem] text-lp-slate tabular-nums">
                  {done} / {totalLessons}
                </span>
              </span>,
              <span key="st" className="flex flex-wrap items-center gap-2">
                <StatusDot tone={tone}>{label}</StatusDot>
                {enrollment.status !== "active" && (
                  <span className="text-[.78rem] text-lp-muted">{enrollment.status}</span>
                )}
              </span>,
              <span key="a" className="flex items-center justify-end gap-3">
                <GhostLink href={`/admin/users/${user.id}`}>{t("edit")}</GhostLink>
                <form action={removeEnrollmentAction.bind(null, user.id, courseId)}>
                  <ConfirmSubmit label={t("remove")} />
                </form>
              </span>,
            ];
          })}
        />
      </Card>
    </>
  );
}

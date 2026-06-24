import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { lessonProgressRepository } from "@/lib/db/repositories/lesson-progress";
import { pickLocale } from "@/lib/i18n/localized";
import { Button } from "@/components/ui/button";
import { CourseProgressCard } from "@/components/student/course-progress-card";
import type { Locale } from "@/lib/i18n/routing";

export default async function MyCoursesPage() {
  const user = await requireUser();
  const t = await getTranslations("Student");
  const locale = (await getLocale()) as Locale;

  const enrolled = await enrollmentsRepository.listActiveWithCourse(user.id);

  const cards = await Promise.all(
    enrolled.map(async ({ course }) => {
      const lessonRows = await lessonsRepository.listByCourse(course.id);
      const ids = lessonRows.map((r) => r.lesson.id);
      const progress = await lessonProgressRepository.forLessons(user.id, ids);
      const completed = progress.filter((p) => p.completed).length;
      const pct = ids.length ? Math.round((completed / ids.length) * 100) : 0;
      return { course, pct };
    }),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy-800">
          {t("myCoursesTitle")}
        </h1>
        <p className="mt-1 text-slate-500">{t("myCoursesSub")}</p>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="text-slate-500">{t("noCourses")}</p>
          <Button render={<Link href="/catalog" />} className="mt-4">
            {t("browseCourses")}
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ course, pct }) => (
            <CourseProgressCard
              key={course.id}
              courseId={course.id}
              title={pickLocale(course.title, locale)}
              pct={pct}
              t={{
                progress: t("progressPct", { percent: pct }),
                resume: t("resume"),
                completed: t("completed"),
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { lessonProgressRepository } from "@/lib/db/repositories/lesson-progress";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { pickLocale } from "@/lib/i18n/localized";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations("Dashboard");
  const tCert = await getTranslations("Certificate");
  const locale = await getLocale();

  const enrolled = await enrollmentsRepository.listActiveWithCourse(user.id);

  const cards = await Promise.all(
    enrolled.map(async ({ course }) => {
      const lessonRows = await lessonsRepository.listByCourse(course.id);
      const ids = lessonRows.map((r) => r.lesson.id);
      const progress = await lessonProgressRepository.forLessons(user.id, ids);
      const completed = progress.filter((p) => p.completed).length;
      const total = ids.length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const certificate = await certificatesRepository.findForUserCourse(
        user.id,
        course.id,
      );
      return { course, pct, total, certificate };
    }),
  );

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-navy-800">
            {t("title")}
          </h1>
          <p className="mt-1 text-slate-500">{t("subtitle")}</p>
        </div>
        <LogoutButton />
      </div>

      {cards.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="text-slate-500">{t("empty")}</p>
          <Button render={<Link href="/catalog" />} className="mt-4">
            {t("browseCourses")}
          </Button>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ course, pct, certificate }) => (
            <li
              key={course.id}
              className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-sm"
            >
              <h2 className="font-heading text-lg font-semibold text-navy-800">
                {pickLocale(course.title, locale)}
              </h2>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-navy-100">
                <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500 tabular-nums">
                {t("progress", { percent: pct })}
              </p>
              <Button
                render={<Link href={`/learn/${course.id}`} />}
                className="mt-4"
                size="sm"
              >
                {pct >= 100 ? t("completed") : t("continue")}
              </Button>
              {certificate && (
                <Button
                  render={<Link href={`/verify/${certificate.verificationCode}`} />}
                  className="mt-2"
                  size="sm"
                  variant="outline"
                >
                  🎓 {tCert("getCertificate")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

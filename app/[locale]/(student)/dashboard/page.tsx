import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { lessonProgressRepository } from "@/lib/db/repositories/lesson-progress";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { pickLocale } from "@/lib/i18n/localized";
import { Button } from "@/components/ui/button";
import { CourseProgressCard } from "@/components/student/course-progress-card";
import { CertCard } from "@/components/student/cert-card";
import type { Locale } from "@/lib/i18n/routing";

export default async function DashboardHomePage() {
  const user = await requireUser();
  const t = await getTranslations("Student");
  const locale = (await getLocale()) as Locale;

  const [enrolled, certs] = await Promise.all([
    enrollmentsRepository.listActiveWithCourse(user.id),
    certificatesRepository.listForUserAll(user.id),
  ]);

  const cards = await Promise.all(
    enrolled.map(async ({ course }) => {
      const lessonRows = await lessonsRepository.listByCourse(course.id);
      const ids = lessonRows.map((r) => r.lesson.id);
      const progress = await lessonProgressRepository.forLessons(user.id, ids);
      const completed = progress.filter((p) => p.completed).length;
      const total = ids.length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { course, pct };
    }),
  );

  const activeCerts = certs.filter((c) => !c.revokedAt);
  const completedCount = cards.filter((c) => c.pct >= 100).length;
  const inProgressCount = cards.filter((c) => c.pct > 0 && c.pct < 100).length;
  const firstName = (user.fullName || user.email || "").split(/\s+/)[0] || "👋";

  const tiles = [
    { label: t("statEnrolled"), value: cards.length },
    { label: t("statCompleted"), value: completedCount },
    { label: t("statCertificates"), value: activeCerts.length },
    { label: t("statInProgress"), value: inProgressCount },
  ];

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy-800">
          {t("greeting", { name: firstName })}
        </h1>
        <p className="mt-1 text-slate-500">{t("greetingSub")}</p>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile, i) => (
          <div
            key={i}
            className="rounded-xl border border-line bg-gradient-to-br from-navy-800 to-navy-900 p-5 text-white shadow-sm"
          >
            <p className="text-sm text-navy-100">{tile.label}</p>
            <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      {/* Continue learning */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-navy-800">
            {t("continueLearning")}
          </h2>
          {cards.length > 0 && (
            <Link href="/dashboard/courses" className="text-sm text-navy-600 hover:underline">
              {t("viewAll")}
            </Link>
          )}
        </div>
        {cards.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
            <p className="text-4xl">📚</p>
            <p className="mt-3 text-slate-500">{t("continueLearningEmpty")}</p>
            <Button render={<Link href="/catalog" />} className="mt-4">
              {t("browseCourses")}
            </Button>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.slice(0, 6).map(({ course, pct }) => (
              <CourseProgressCard
                key={course.id}
                courseId={course.id}
                title={pickLocale(course.title, locale)}
                pct={pct}
                t={{ progress: t("progressPct", { percent: pct }), resume: t("resume"), completed: t("completed") }}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Certificates */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-navy-800">
            {t("myCertificates")}
          </h2>
          {activeCerts.length > 0 && (
            <Link href="/dashboard/certificates" className="text-sm text-navy-600 hover:underline">
              {t("viewAll")}
            </Link>
          )}
        </div>
        {activeCerts.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-line bg-surface p-10 text-center">
            <p className="text-4xl">🎓</p>
            <p className="mt-3 text-slate-500">{t("certificatesEmpty")}</p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeCerts.slice(0, 3).map((c) => (
              <CertCard
                key={c.id}
                code={c.verificationCode}
                title={pickLocale(c.courseTitle, locale)}
                issued={new Date(c.issuedAt).toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ")}
                labels={{ download: t("download"), verify: t("verify") }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

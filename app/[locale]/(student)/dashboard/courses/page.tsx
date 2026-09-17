import { ArrowRight, Check, Play } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { attemptsRepository } from "@/lib/db/repositories/attempts";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { getCurriculum } from "@/lib/learning/curriculum";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/student/page-header";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Every enrolment as one row: a progress strip of real lesson ticks, where to
 * resume, and when access ends. One row per course rather than a grid of cards
 * — a student has two or three courses, not twenty, and a row has room to say
 * what the next action is instead of only how far along they are.
 */
export default async function MyCoursesPage() {
  const user = await requireUser();
  const t = await getTranslations("Student");
  const locale = (await getLocale()) as Locale;

  const [enrolled, certs, attempts] = await Promise.all([
    enrollmentsRepository.listActiveWithCourse(user.id),
    certificatesRepository.listForUserAll(user.id),
    attemptsRepository.listForUserAll(user.id),
  ]);

  const rows = await Promise.all(
    enrolled.map(async ({ enrollment, course }) => {
      const curriculum = await getCurriculum(course.id, user.id);
      const finals = attempts.filter(
        (a) =>
          a.assessment.courseId === course.id &&
          a.assessment.type === "final_exam" &&
          a.attempt.passed,
      );
      const bestFinal = finals.reduce<number | null>(
        (best, a) => Math.max(best ?? 0, a.attempt.scorePct ?? 0),
        null,
      );
      const cert = certs.find((c) => c.courseId === course.id && !c.revokedAt) ?? null;
      const done =
        curriculum.lessonCount > 0 && curriculum.completedCount >= curriculum.lessonCount;
      return { enrollment, course, curriculum, bestFinal, cert, done };
    }),
  );

  const dateLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ";
  const fmt = (d: Date) => new Date(d).toLocaleDateString(dateLocale);
  const inProgress = rows.filter((r) => !r.done).length;

  return (
    <>
      <PageHeader
        eyebrow={t("navCourses")}
        title={
          rows.length === 0
            ? t("subCourses")
            : t("coursesSummary", { total: rows.length, active: inProgress })
        }
        userId={user.id}
        role={user.role}
      />

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-lp-line-strong bg-surface p-12 text-center">
          <p className="font-lp-heading text-[1.3rem] font-semibold text-lp-navy">
            {t("emptyNoCourse")}
          </p>
          <p className="mx-auto mt-2 max-w-[46ch] text-[.92rem] text-lp-slate">
            {t("emptyNoCourseSub")}
          </p>
          <Button render={<Link href="/dashboard/catalog" />} className="mt-5">
            {t("browseCatalog")}
          </Button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-lp-line bg-surface shadow-[0_2px_10px_rgba(2,58,105,.05)]">
          {rows.map((r, i) => {
            const pct =
              r.curriculum.lessonCount > 0
                ? (r.curriculum.completedCount / r.curriculum.lessonCount) * 100
                : 0;
            const resumeHref = r.curriculum.resumeLessonId
              ? `/learn/${r.course.id}/${r.curriculum.resumeLessonId}`
              : `/courses/${r.course.slug}`;
            const nextLesson = r.curriculum.modules
              .flatMap((m) => m.lessons)
              .find((l) => l.id === r.curriculum.resumeLessonId);

            return (
              <div
                key={r.course.id}
                className={cn(
                  "grid items-center gap-6 p-7 sm:grid-cols-[200px_1fr] lg:grid-cols-[200px_1fr_auto]",
                  i < rows.length - 1 && "border-b border-lp-line-soft",
                )}
              >
                <Link
                  href={resumeHref}
                  className="relative block overflow-hidden rounded-[10px] bg-lp-navy-dark"
                  style={{ aspectRatio: "16/10" }}
                >
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                    <span
                      className={cn("block h-full", r.done ? "bg-lp-navy" : "bg-lp-gold")}
                      style={{ width: `${r.done ? 100 : pct}%` }}
                    />
                  </span>
                </Link>

                <div className="min-w-0">
                  <p
                    className={cn(
                      "mb-1.5 text-[.7rem] font-bold uppercase tracking-[.1em]",
                      r.done ? "text-lp-muted" : "text-lp-gold-deep",
                    )}
                  >
                    {r.done ? t("completedLabel") : t("inProgressLabel")} &middot;{" "}
                    {t("lessonsCount", { count: r.curriculum.lessonCount })}
                  </p>
                  <h3 className="mb-2.5 font-lp-heading text-[1.3rem] font-semibold text-lp-navy">
                    <Link href={`/courses/${r.course.slug}`} className="hover:underline">
                      {pickLocale(r.course.title, locale)}
                    </Link>
                  </h3>
                  <div className="mb-2.5 flex max-w-[320px] gap-1">
                    {r.curriculum.modules
                      .flatMap((m) => m.lessons)
                      .map((l) => (
                        <span
                          key={l.id}
                          title={pickLocale(l.title, locale)}
                          className={cn(
                            "h-2 flex-1 rounded-[2px] border-[1.5px]",
                            l.completed
                              ? "border-lp-navy bg-lp-navy"
                              : l.id === r.curriculum.resumeLessonId
                                ? "border-lp-gold bg-lp-gold"
                                : "border-lp-line-strong bg-transparent",
                          )}
                        />
                      ))}
                  </div>
                  <p className="flex flex-wrap items-center gap-3 text-[.84rem] text-lp-slate">
                    <span className="tabular-nums">
                      {r.curriculum.completedCount} / {r.curriculum.lessonCount}
                    </span>
                    {!r.done && nextLesson && (
                      <>
                        <span aria-hidden className="text-lp-line-strong">|</span>
                        <span className="truncate">
                          {t("nextLessonLabel", { title: pickLocale(nextLesson.title, locale) })}
                        </span>
                      </>
                    )}
                    {r.done && r.bestFinal != null && (
                      <>
                        <span aria-hidden className="text-lp-line-strong">|</span>
                        <span>{t("finalScoreLabel", { pct: r.bestFinal })}</span>
                      </>
                    )}
                    {r.done && r.cert && (
                      <>
                        <span aria-hidden className="text-lp-line-strong">|</span>
                        <span>{t("certIssuedLabel", { date: fmt(r.cert.issuedAt) })}</span>
                      </>
                    )}
                    {!r.done && r.enrollment.expiresAt && (
                      <>
                        <span aria-hidden className="text-lp-line-strong">|</span>
                        <span>{t("accessUntil", { date: fmt(r.enrollment.expiresAt) })}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-2 lg:items-end">
                  {r.done && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-lp-tint px-3 py-1 text-[.78rem] font-bold text-lp-navy">
                      <Check className="size-3" strokeWidth={3} />
                      {t("completedLabel")}
                    </span>
                  )}
                  <Button
                    render={<Link href={resumeHref} />}
                    variant={r.done ? "outline" : "default"}
                    className={cn(
                      "whitespace-nowrap",
                      !r.done &&
                        "bg-lp-gold text-lp-navy-deep shadow-[0_6px_18px_rgba(248,184,1,.3)] hover:bg-lp-gold",
                    )}
                  >
                    {!r.done && <Play className="size-3 fill-current" />}
                    {r.done ? t("reviewCourse") : t("resumeContinue")}
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-lp-line-strong px-7 py-6">
        <div>
          <p className="mb-1 text-[.98rem] font-bold text-lp-ink">{t("pickNextTitle")}</p>
          <p className="text-[.88rem] text-lp-slate">{t("pickNextSub")}</p>
        </div>
        <Button render={<Link href="/dashboard/catalog" />} variant="outline">
          {t("navCatalog")} <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </>
  );
}

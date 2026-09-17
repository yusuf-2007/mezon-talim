import { Award } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { formatTiyin } from "@/lib/payments";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/student/page-header";
import { Lattice } from "@/components/student/lattice";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/routing";

/**
 * The catalogue, inside the dashboard shell.
 *
 * The public /catalog is for people deciding whether to sign up at all; this
 * one is for an enrolled student picking a second course, so it knows what they
 * already own and says "continue" rather than "buy" on those rows.
 */
export default async function DashboardCatalogPage() {
  const user = await requireUser();
  const t = await getTranslations("Student");
  const tCourse = await getTranslations("Course");
  const locale = (await getLocale()) as Locale;

  const [published, enrolled] = await Promise.all([
    coursesRepository.listPublished(),
    enrollmentsRepository.listActiveWithCourse(user.id),
  ]);
  const mine = new Set(enrolled.map((e) => e.course.id));

  const rows = await Promise.all(
    published.map(async (course) => {
      const lessons = await lessonsRepository.listByCourse(course.id);
      return {
        course,
        lessonCount: lessons.length,
        hasPreview: lessons.some((l) => l.lesson.isPreview),
        owned: mine.has(course.id),
      };
    }),
  );

  return (
    <>
      <PageHeader
        eyebrow={t("navCatalog")}
        title={t("subCatalog")}
        userId={user.id}
        role={user.role}
      />

      <div className="mb-4 flex items-baseline justify-between gap-4">
        <p className="text-[.72rem] font-bold uppercase tracking-[.14em] text-lp-gold-deep">
          {t("catalogSelfPaced")}
        </p>
        <p className="text-[.82rem] text-lp-muted">
          {t("catalogCount", { count: rows.length })}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-lp-line-strong bg-surface p-12 text-center text-[.92rem] text-lp-slate">
          {t("catalogEmpty")}
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-lp-line bg-surface shadow-[0_2px_10px_rgba(2,58,105,.05)]">
          {rows.map(({ course, lessonCount, hasPreview, owned }, i) => (
            <div
              key={course.id}
              className={cn(
                "grid items-center gap-6 p-7 sm:grid-cols-[200px_1fr] lg:grid-cols-[200px_1fr_auto]",
                i < rows.length - 1 && "border-b border-lp-line-soft",
              )}
            >
              <Link
                href={`/courses/${course.slug}`}
                className="relative block overflow-hidden rounded-[10px] bg-lp-navy-dark"
                style={{ aspectRatio: "16/10" }}
              >
                <Lattice size={30} opacity={0.1} />
                {(owned || hasPreview) && (
                  <span
                    className={cn(
                      "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[.64rem] font-bold",
                      owned
                        ? "bg-lp-gold-tint text-lp-gold-ink"
                        : "bg-lp-tint text-lp-navy",
                    )}
                  >
                    {owned ? t("catalogEnrolled") : t("catalogFree")}
                  </span>
                )}
              </Link>

              <div className="min-w-0">
                <p className="mb-1.5 text-[.7rem] font-bold uppercase tracking-[.1em] text-lp-gold-deep">
                  {t("lessonsCount", { count: lessonCount })}
                </p>
                <h3 className="mb-1.5 font-lp-heading text-[1.25rem] font-semibold text-lp-navy">
                  <Link href={`/courses/${course.slug}`} className="hover:underline">
                    {pickLocale(course.title, locale)}
                  </Link>
                </h3>
                {course.summary && (
                  <p className="mb-2 max-w-[60ch] text-[.88rem] leading-relaxed text-lp-slate">
                    {pickLocale(course.summary, locale)}
                  </p>
                )}
                {course.certificateEnabled && (
                  <p className="inline-flex items-center gap-1.5 text-[.8rem] font-semibold text-lp-slate">
                    <Award className="size-[15px] shrink-0 text-lp-gold-deep" strokeWidth={1.9} />
                    {t("catalogCertificate")}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-start gap-2 lg:items-end">
                <p className="font-lp-heading text-[1.2rem] font-semibold text-lp-navy">
                  {course.priceTiyin > 0 ? formatTiyin(course.priceTiyin) : tCourse("free")}
                </p>
                <Button
                  render={<Link href={`/courses/${course.slug}`} />}
                  variant={owned ? "default" : "outline"}
                  className={cn(
                    "whitespace-nowrap",
                    owned &&
                      "bg-lp-gold text-lp-navy-deep shadow-[0_6px_18px_rgba(248,184,1,.3)] hover:bg-lp-gold",
                  )}
                >
                  {owned ? t("resumeContinue") : t("catalogDetails")}
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <p className="mt-4 px-1 text-[.8rem] text-lp-muted">{t("catalogPaymentNote")}</p>
    </>
  );
}

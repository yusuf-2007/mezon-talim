import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { getCurrentUser } from "@/lib/auth";
import { getCurriculum } from "@/lib/learning/curriculum";
import { pickLocale } from "@/lib/i18n/localized";
import type { Locale } from "@/lib/i18n/routing";
import { CurriculumAccordion } from "@/components/catalog/curriculum-accordion";
import { EnrollCard } from "@/components/catalog/enroll-card";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Course");

  const course = await coursesRepository.findBySlug(slug);
  if (!course || course.status !== "published") notFound();

  const user = await getCurrentUser();
  const curriculum = await getCurriculum(course.id, user?.id ?? null);
  const loc = await getLocale();

  return (
    <div>
      {/* Navy hero */}
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h1 className="max-w-3xl font-heading text-3xl font-semibold leading-tight sm:text-4xl">
            {pickLocale(course.title, loc)}
          </h1>
          {course.summary && (
            <p className="mt-4 max-w-2xl text-lg text-navy-100">
              {pickLocale(course.summary, loc)}
            </p>
          )}
        </div>
      </section>

      {/* Body: description + curriculum | sticky enroll card */}
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-10">
          {course.description && pickLocale(course.description, loc) && (
            <div>
              <h2 className="font-heading text-2xl font-semibold text-navy-800">
                {t("overview")}
              </h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-ink">
                {pickLocale(course.description, loc)}
              </p>
            </div>
          )}

          <div>
            <h2 className="mb-3 font-heading text-2xl font-semibold text-navy-800">
              {t("curriculum")}
            </h2>
            <CurriculumAccordion courseId={course.id} curriculum={curriculum} />
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <EnrollCard
            courseId={course.id}
            priceTiyin={course.priceTiyin}
            lessonCount={curriculum.lessonCount}
            certificateEnabled={course.certificateEnabled}
            accessDurationDays={course.accessDurationDays}
            isAuthed={Boolean(user)}
            enrolled={curriculum.enrolled}
          />
        </aside>
      </section>
    </div>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { CourseCard, type CatalogCourse } from "@/components/catalog/course-card";
import type { Locale } from "@/lib/i18n/routing";

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Catalog");

  const courses = await coursesRepository.listPublished();
  const counts = await lessonsRepository.countByCourses(courses.map((c) => c.id));

  const cards: CatalogCourse[] = await Promise.all(
    courses.map(async (c) => {
      // A course has a free entry point if any non-deleted lesson is a preview.
      const lessons = await lessonsRepository.listByCourse(c.id);
      const hasPreview = lessons.some((l) => l.lesson.isPreview);
      return {
        slug: c.slug,
        title: c.title,
        summary: c.summary ?? null,
        coverUrl: c.coverUrl,
        priceTiyin: c.priceTiyin,
        lessonCount: counts.get(c.id) ?? 0,
        hasPreview,
      };
    }),
  );

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-heading text-3xl font-semibold text-navy-800">
        {t("title")}
      </h1>
      <p className="mt-1 text-slate-500">{t("subtitle")}</p>

      {cards.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-line bg-surface p-10 text-center text-slate-500">
          {t("empty")}
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((course) => (
            <CourseCard key={course.slug} course={course} />
          ))}
        </div>
      )}
    </section>
  );
}

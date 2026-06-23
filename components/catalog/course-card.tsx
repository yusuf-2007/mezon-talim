import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { pickLocale } from "@/lib/i18n/localized";
import { formatTiyin } from "@/lib/payments";
import { Badge } from "@/components/ui/badge";
import type { LocalizedText } from "@/lib/db/schema";

export type CatalogCourse = {
  slug: string;
  title: LocalizedText;
  summary: LocalizedText | null;
  coverUrl: string | null;
  priceTiyin: number;
  lessonCount: number;
  hasPreview: boolean;
};

export async function CourseCard({ course }: { course: CatalogCourse }) {
  const locale = await getLocale();
  const t = await getTranslations("Catalog");

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-video w-full overflow-hidden bg-navy-100">
        {course.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-heading text-navy-800/30">
            Mezon Ta&apos;lim
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-heading text-lg font-semibold text-navy-800">
          {pickLocale(course.title, locale)}
        </h3>
        {course.summary && (
          <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">
            {pickLocale(course.summary, locale)}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-sm text-slate-500">
            {t("lessons", { count: course.lessonCount })}
          </span>
          <div className="flex items-center gap-2">
            {course.hasPreview && (
              <Badge className="bg-gold-100 text-navy-800">{t("free")}</Badge>
            )}
            <span className="font-medium tabular-nums text-navy-800">
              {course.priceTiyin > 0 ? formatTiyin(course.priceTiyin) : t("free")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

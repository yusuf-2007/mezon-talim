import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { formatTiyin } from "@/lib/payments";
import { devEnrollAction } from "@/lib/learning/actions";
import { Button } from "@/components/ui/button";

/**
 * Sticky enroll card on the course-detail page. Branches on auth + enrollment:
 *  - anonymous  → "log in to enroll"
 *  - enrolled   → "continue" into the player
 *  - otherwise  → dev enroll (Phase 5 swaps this for Click/Payme checkout)
 */
export async function EnrollCard({
  courseId,
  priceTiyin,
  lessonCount,
  certificateEnabled,
  accessDurationDays,
  isAuthed,
  enrolled,
}: {
  courseId: string;
  priceTiyin: number;
  lessonCount: number;
  certificateEnabled: boolean;
  accessDurationDays: number;
  isAuthed: boolean;
  enrolled: boolean;
}) {
  const t = await getTranslations("Course");

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <p className="font-heading text-3xl font-semibold tabular-nums text-navy-800">
        {priceTiyin > 0 ? formatTiyin(priceTiyin) : t("free")}
      </p>

      <div className="mt-5">
        {enrolled ? (
          <Button render={<Link href={`/learn/${courseId}`} />} className="w-full" size="lg">
            {t("goToCourse")}
          </Button>
        ) : isAuthed ? (
          <form action={devEnrollAction.bind(null, courseId)}>
            <Button type="submit" className="w-full" size="lg">
              {t("enrollDev")}
            </Button>
          </form>
        ) : (
          <Button render={<Link href="/login" />} className="w-full" size="lg">
            {t("loginToEnroll")}
          </Button>
        )}
      </div>

      <ul className="mt-6 space-y-2 text-sm text-slate-500">
        <li className="flex items-center gap-2">
          <span className="text-navy-600">•</span> {t("nLessons", { count: lessonCount })}
        </li>
        {certificateEnabled && (
          <li className="flex items-center gap-2">
            <span className="text-navy-600">•</span> {t("certificate")}
          </li>
        )}
        <li className="flex items-center gap-2">
          <span className="text-navy-600">•</span> {t("accessDuration", { days: accessDurationDays })}
        </li>
      </ul>
    </div>
  );
}

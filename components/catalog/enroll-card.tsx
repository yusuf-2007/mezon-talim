import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { enabledPaymentProviders, formatTiyin } from "@/lib/payments";
import { startCheckoutAction } from "@/lib/payments/actions";
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
  const providers = enabledPaymentProviders();

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <p className="font-heading text-3xl font-semibold tabular-nums text-navy-800">
        {priceTiyin > 0 ? formatTiyin(priceTiyin) : t("free")}
      </p>

      <div className="mt-5 space-y-2">
        {enrolled ? (
          <Button render={<Link href={`/learn/${courseId}`} />} className="w-full" size="lg">
            {t("goToCourse")}
          </Button>
        ) : !isAuthed ? (
          <Button render={<Link href="/login" />} className="w-full" size="lg">
            {t("loginToEnroll")}
          </Button>
        ) : providers.length > 0 ? (
          <>
            {providers.includes("click") && (
              <form action={startCheckoutAction.bind(null, courseId, "click")}>
                <Button type="submit" className="w-full" size="lg">
                  {t("payWithClick")}
                </Button>
              </form>
            )}
            {providers.includes("payme") && (
              <form action={startCheckoutAction.bind(null, courseId, "payme")}>
                <Button
                  type="submit"
                  variant={providers.includes("click") ? "outline" : "default"}
                  className="w-full"
                  size="lg"
                >
                  {t("payWithPayme")}
                </Button>
              </form>
            )}
          </>
        ) : (
          // No provider configured → dev-only free enroll (Phase 5 fallback).
          <form action={devEnrollAction.bind(null, courseId)}>
            <Button type="submit" className="w-full" size="lg">
              {t("enrollDev")}
            </Button>
            <p className="mt-2 text-center text-xs text-slate-500">{t("devEnrollNote")}</p>
          </form>
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

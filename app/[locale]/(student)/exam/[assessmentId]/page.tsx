import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getExamOverview } from "@/lib/assessments/service";
import { startExamAction } from "@/lib/assessments/actions";
import { pickLocale } from "@/lib/i18n/localized";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PreExamPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  const user = await requireUser();
  const t = await getTranslations("Exam");
  const locale = await getLocale();

  const o = await getExamOverview(assessmentId, user.id);
  if (!o) notFound();
  const a = o.assessment;

  const cooldownText = o.cooldownUntil
    ? new Date(o.cooldownUntil).toLocaleString(locale === "ru" ? "ru-RU" : "uz-UZ")
    : "";

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl text-navy-800">
            {pickLocale(a.title, locale)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <h2 className="font-medium text-navy-800">{t("rulesTitle")}</h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-500">
              <li>• {t("questionsCount", { count: o.questionCount })}</li>
              <li>
                •{" "}
                {a.timeLimitSeconds
                  ? t("timeLimit", { minutes: Math.round(a.timeLimitSeconds / 60) })
                  : t("untimed")}
              </li>
              {a.isScored && <li>• {t("threshold", { pct: a.passThresholdPct })}</li>}
              <li>
                •{" "}
                {o.attemptsLeft == null
                  ? t("unlimitedAttempts")
                  : t("attemptsLeft", { count: o.attemptsLeft })}
              </li>
              {o.bestScorePct != null && (
                <li>• {t("bestScore", { pct: o.bestScorePct })}</li>
              )}
            </ul>
          </div>

          {o.blockedReason ? (
            <p className="rounded-lg bg-gold-100 px-4 py-3 text-sm text-navy-800">
              {o.blockedReason === "cooldown"
                ? t("blocked_cooldown", { time: cooldownText })
                : t(`blocked_${o.blockedReason}`)}
            </p>
          ) : (
            <form action={startExamAction.bind(null, assessmentId)}>
              <Button type="submit" size="lg" disabled={o.questionCount === 0}>
                {o.inProgress ? t("resume") : t("start")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

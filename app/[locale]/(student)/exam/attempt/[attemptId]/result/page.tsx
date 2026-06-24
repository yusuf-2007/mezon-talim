import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { getResult } from "@/lib/assessments/service";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { pickLocale } from "@/lib/i18n/localized";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function ExamResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const user = await requireUser();
  const t = await getTranslations("Exam");
  const locale = await getLocale();

  const result = await getResult(attemptId, user.id);
  if (!result) notFound();
  const course = await coursesRepository.findById(result.assessment.courseId);

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div
        className={cn(
          "rounded-xl border p-8 text-center",
          result.passed ? "border-success/40 bg-success/5" : "border-danger/40 bg-danger/5",
        )}
      >
        <p className="text-5xl">{result.passed ? "🎉" : "📘"}</p>
        <h1 className="mt-4 font-heading text-2xl font-semibold text-navy-800">
          {result.isScored ? (result.passed ? t("passed") : t("failed")) : t("resultTitle")}
        </h1>
        {result.isScored && (
          <p className="mt-2 text-lg font-medium tabular-nums text-navy-800">
            {t("yourScore", { pct: result.scorePct })}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          {!result.passed && result.isScored && (
            <Button render={<Link href={`/exam/${result.assessment.id}`} />} variant="outline">
              {t("retry")}
            </Button>
          )}
          {course && (
            <Button render={<Link href={`/courses/${course.slug}`} />}>
              {t("backToCourse")}
            </Button>
          )}
        </div>
      </div>

      {/* Answer review — only after passing (B16) */}
      <div className="mt-8">
        <h2 className="font-heading text-xl font-semibold text-navy-800">
          {t("reviewTitle")}
        </h2>
        {!result.reviewAllowed ? (
          <p className="mt-3 rounded-lg bg-gold-100 px-4 py-3 text-sm text-navy-800">
            {t("reviewLocked")}
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {result.review!.map((r, i) => (
              <li key={i} className="rounded-xl border border-line bg-surface p-4">
                <p className="flex items-start gap-2 font-medium text-ink">
                  <span aria-hidden>{r.correct ? "✓" : "✗"}</span>
                  <span>{pickLocale(r.prompt, locale)}</span>
                </p>
                <ul className="mt-3 space-y-1.5">
                  {r.options.map((o) => {
                    const picked = r.selected.includes(o.id);
                    return (
                      <li
                        key={o.id}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm",
                          o.isCorrect && "bg-success/10 text-success",
                          picked && !o.isCorrect && "bg-danger/10 text-danger",
                        )}
                      >
                        <span aria-hidden>
                          {o.isCorrect ? "✓" : picked ? "✗" : "•"}
                        </span>
                        {pickLocale(o.label, locale)}
                      </li>
                    );
                  })}
                </ul>
                {r.explanation && pickLocale(r.explanation, locale) && (
                  <p className="mt-2 text-sm text-slate-500">
                    {pickLocale(r.explanation, locale)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

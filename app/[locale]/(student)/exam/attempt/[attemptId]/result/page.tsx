import { ArrowLeft, Award, Check, Download, RotateCcw, Trophy, X } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { getResult } from "@/lib/assessments/service";
import { issueIfEligible } from "@/lib/certificates/service";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { pickLocale } from "@/lib/i18n/localized";
import { Button } from "@/components/ui/button";
import { CoursePlayerShell } from "@/components/player/course-player-shell";
import { cn } from "@/lib/utils";

function fmtDuration(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

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

  // On a pass, auto-issue the completion certificate (idempotent) and surface it.
  const certificate = result.passed
    ? await issueIfEligible(user.id, result.assessment.courseId)
    : null;

  const body = (
    <section className="mx-auto max-w-2xl">
      <div
        className={cn(
          "rounded-xl border p-8 text-center",
          result.passed ? "border-success/40 bg-success/5" : "border-danger/40 bg-danger/5",
        )}
      >
        <span
          className={cn(
            "mx-auto flex size-16 items-center justify-center rounded-full",
            result.passed ? "bg-success/15 text-success" : "bg-danger/10 text-danger",
          )}
          aria-hidden
        >
          {result.passed ? <Trophy className="size-8" /> : <RotateCcw className="size-8" />}
        </span>
        <h1 className="mt-4 font-heading text-2xl font-semibold text-navy-800">
          {result.isScored ? (result.passed ? t("passed") : t("failed")) : t("resultTitle")}
        </h1>
        {result.isScored && (
          <>
            <p className="mt-2 text-lg font-medium tabular-nums text-navy-800">
              {t("yourScore", { pct: result.scorePct })}
            </p>
            <div className="mx-auto mt-3 h-2 max-w-xs overflow-hidden rounded-full bg-navy-100">
              <div
                className={cn(
                  "h-full rounded-full",
                  result.passed ? "bg-success" : "bg-danger",
                )}
                style={{ width: `${result.scorePct}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-500 tabular-nums">
              {t("correctCount", {
                correct: result.correctCount,
                total: result.totalCount,
              })}
              {" · "}
              {t("timeSpent")}: {fmtDuration(result.timeSpentSeconds)}
            </p>
          </>
        )}
        {/* The certificate is the point of passing, so it gets two large
            actions of its own; everything else hangs below, smaller. */}
        <div className="mx-auto mt-6 max-w-md space-y-3">
          {certificate && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                render={
                  <a
                    href={`/api/certificates/${certificate.verificationCode}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
                size="lg"
              >
                <Download className="size-4" />
                {t("downloadCertificate")}
              </Button>
              <Button
                render={<Link href={`/verify/${certificate.verificationCode}`} />}
                size="lg"
                variant="outline"
              >
                <Award className="size-4" />
                {t("viewCertificate")}
              </Button>
            </div>
          )}
          {!result.passed && result.isScored && (
            <Button render={<Link href={`/exam/${result.assessment.id}`} />} size="lg" className="w-full">
              <RotateCcw className="size-4" />
              {t("retry")}
            </Button>
          )}
          {course && (
            <Button
              render={<Link href={`/courses/${course.slug}`} />}
              variant={certificate || (!result.passed && result.isScored) ? "ghost" : "default"}
              size="sm"
              className="w-full"
            >
              <ArrowLeft className="size-4" />
              {t("backToCourse")}
            </Button>
          )}
        </div>
      </div>

      {/* Per-module breakdown (informational — overall % decides pass/fail) */}
      {result.moduleBreakdown.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-semibold text-navy-800">
            {t("moduleBreakdown")}
          </h2>
          <ul className="mt-4 space-y-2">
            {result.moduleBreakdown.map((m, i) => {
              const pass = m.pct >= result.passThresholdPct;
              return (
                <li
                  key={m.moduleId ?? `none-${i}`}
                  className="rounded-lg border border-line bg-surface p-3"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink">
                      {m.title ? pickLocale(m.title, locale) : t("moduleGeneral")}
                    </span>
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        pass ? "text-success" : "text-danger",
                      )}
                    >
                      {m.pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        pass ? "bg-success" : "bg-danger",
                      )}
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
                  <span aria-hidden>{r.correct ? <Check className="size-4" /> : <X className="size-4" />}</span>
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

  // Final-exam results stay inside the course-player shell (sidebar visible).
  if (result.assessment.type === "final_exam" && course) {
    return (
      <CoursePlayerShell
        courseId={result.assessment.courseId}
        courseSlug={course.slug}
        userId={user.id}
        activeLessonId="exam"
      >
        {body}
      </CoursePlayerShell>
    );
  }
  return <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">{body}</div>;
}

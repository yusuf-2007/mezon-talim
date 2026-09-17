"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { completeLessonAction } from "@/lib/learning/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Check, GraduationCap, Trophy } from "lucide-react";

/** What comes after the last lesson, when there is a final exam to sit. */
export type FinalExamNext = {
  href: string;
  state: "ready" | "passed" | "locked" | "needs_approval";
};

/**
 * Mark-complete (with 1–5 self-assessment, B11) + prev/next navigation. The
 * "next" link is gated on completion — sequential unlock (B2) is enforced
 * server-side; this just reflects it. After completing, the server revalidates
 * and re-renders with `completed=true`.
 *
 * On the last lesson the "next" slot points at the final exam instead of
 * going empty. Before this, finishing the course left a student with only
 * "previous lesson" and the exam had to be discovered in the sidebar.
 */
export function CompleteControls({
  lessonId,
  completed,
  prevHref,
  nextHref,
  finalExam = null,
}: {
  lessonId: string;
  completed: boolean;
  prevHref: string | null;
  nextHref: string | null;
  finalExam?: FinalExamNext | null;
}) {
  const t = useTranslations("Player");
  const [score, setScore] = useState<number | "">("");
  const [, formAction, pending] = useActionState(completeLessonAction, { ok: false });

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      {!completed && (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="lessonId" value={lessonId} />
          <input type="hidden" name="selfAssessment" value={score} />
          <div>
            <p className="text-sm text-slate-500">{t("selfAssessment")}</p>
            <div className="mt-2 flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore((s) => (s === n ? "" : n))}
                  className={cn(
                    "size-9 rounded-md border text-sm font-medium tabular-nums transition-colors",
                    score === n
                      ? "border-navy-800 bg-navy-800 text-white"
                      : "border-line text-slate-500 hover:border-navy-600",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={pending}>
            {t("markComplete")}
          </Button>
        </form>
      )}

      {completed && (
        <p className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
          <Check className="size-4" strokeWidth={2.5} /> {t("completed")}
        </p>
      )}

      {/* Last lesson done and an exam waits: say so, and make it the obvious
          next step rather than something to hunt for in the sidebar. */}
      {completed && !nextHref && finalExam && (
        <div className="mt-4 rounded-xl border border-gold-400 bg-gold-100/50 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-gold-400">
              {finalExam.state === "passed" ? (
                <Trophy className="size-5" />
              ) : (
                <GraduationCap className="size-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading font-semibold text-navy-800">
                {t("allLessonsDone")}
              </p>
              <p className="mt-0.5 text-sm text-slate-600">
                {finalExam.state === "passed" ? t("examAlreadyPassed") : t("examNextHint")}
              </p>
              <Button
                render={<Link href={finalExam.href} />}
                size="lg"
                className="mt-4 w-full sm:w-auto"
              >
                {finalExam.state === "passed" ? t("viewExamResult") : t("proceedToExam")}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
        {prevHref ? (
          <Button render={<Link href={prevHref} />} variant="outline" size="sm">
            <ArrowLeft className="size-4" /> {t("prevLesson")}
          </Button>
        ) : (
          <span />
        )}
        {nextHref && (
          <Button
            render={<Link href={nextHref} />}
            size="sm"
            variant={completed ? "default" : "outline"}
          >
            {t("nextLesson")} <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { completeLessonAction } from "@/lib/learning/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Mark-complete (with 1–5 self-assessment, B11) + prev/next navigation. The
 * "next" link is gated on completion — sequential unlock (B2) is enforced
 * server-side; this just reflects it. After completing, the server revalidates
 * and re-renders with `completed=true`.
 */
export function CompleteControls({
  lessonId,
  completed,
  prevHref,
  nextHref,
}: {
  lessonId: string;
  completed: boolean;
  prevHref: string | null;
  nextHref: string | null;
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
          ✓ {t("completed")}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
        {prevHref ? (
          <Button render={<Link href={prevHref} />} variant="outline" size="sm">
            ← {t("prevLesson")}
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
            {t("nextLesson")} →
          </Button>
        )}
      </div>
    </div>
  );
}

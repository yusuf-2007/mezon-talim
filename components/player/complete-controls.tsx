"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { completeLessonAction } from "@/lib/learning/actions";
import { cn } from "@/lib/utils";

/**
 * The strip under the video: how well it landed (1–5, optional, B11), mark the
 * lesson done, and go on.
 *
 * "Next" is dimmed until the lesson is done, because sequential unlock (B2) is
 * enforced server-side and a live-looking link to a locked lesson would only
 * bounce. On the last lesson, next is the exam rather than nothing.
 */
export function CompleteControls({
  lessonId,
  completed,
  next,
  videoId = null,
  partsLeft = null,
}: {
  lessonId: string;
  completed: boolean;
  /** The part on screen; sent along so it counts as opened. */
  videoId?: string | null;
  /**
   * A lesson in parts with some still unopened: completion waits for them
   * (the server checks too). `href` opens the first part not yet opened.
   */
  partsLeft?: { opened: number; total: number; href: string } | null;
  /** Where "next" goes: the following lesson, the exam, or nowhere. */
  next: { href: string; kind: "lesson" | "exam" } | null;
}) {
  const t = useTranslations("Player");
  const [score, setScore] = useState<number | null>(null);
  const [, formAction, pending] = useActionState(completeLessonAction, { ok: false });
  const words = ["", t("rate1"), t("rate2"), t("rate3"), t("rate4"), t("rate5")];

  const nextLabel = next?.kind === "exam" ? t("toExam") : t("nextLesson");
  const nextCls =
    "inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-3 text-[.92rem] font-bold text-lp-navy";

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center justify-between gap-5 rounded-[14px] border border-lp-line bg-white px-[22px] py-[18px]"
    >
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="selfAssessment" value={score ?? ""} />
      {videoId && <input type="hidden" name="videoId" value={videoId} />}

      <div>
        <p className="mb-2.5 text-[.86rem] font-bold text-lp-ink">{t("selfAssessment")}</p>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={completed}
              aria-pressed={score === n}
              onClick={() => setScore((s) => (s === n ? null : n))}
              className={cn(
                "grid size-[38px] place-items-center rounded-[9px] border-[1.5px] text-[.92rem] font-bold tabular-nums transition-colors disabled:cursor-default",
                score === n
                  ? "border-lp-navy bg-lp-navy text-white"
                  : "border-lp-line bg-white text-lp-navy hover:border-lp-navy",
              )}
            >
              {n}
            </button>
          ))}
          <span className="ml-2 text-[.8rem] text-lp-muted">
            {score ? words[score] : t("rateOptional")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {completed ? (
          <span className="inline-flex items-center gap-2 rounded-[10px] border-[1.5px] border-[#BFE3CF] bg-lp-success-tint px-[18px] py-3 text-[.92rem] font-bold text-lp-success">
            ✓ {t("completed")}
          </span>
        ) : (
          partsLeft ? (
            <span className="flex flex-col items-end gap-1 text-right">
              <span
                aria-disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-[10px] border-[1.5px] border-lp-line bg-lp-line-soft px-[18px] py-3 text-[.92rem] font-bold text-lp-muted"
              >
                {t("markComplete")}
              </span>
              <Link href={partsLeft.href} className="text-[.8rem] font-bold text-lp-navy-mid hover:underline">
                {t("partsLeftToComplete", { opened: partsLeft.opened, total: partsLeft.total })}
              </Link>
            </span>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-[10px] border-[1.5px] border-lp-gold bg-lp-gold px-[18px] py-3 text-[.92rem] font-bold text-lp-navy-deep transition hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(248,184,1,.4)] disabled:opacity-60"
            >
              {t("markComplete")}
            </button>
          )
        )}
        {next &&
          (completed ? (
            <Link href={next.href} className={cn(nextCls, "hover:bg-lp-wash")}>
              {nextLabel}
            </Link>
          ) : (
            <span aria-disabled className={cn(nextCls, "cursor-not-allowed opacity-45")}>
              {nextLabel}
            </span>
          ))}
      </div>
    </form>
  );
}

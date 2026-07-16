"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  saveAnswerAction,
  submitExamAction,
} from "@/lib/assessments/actions";
import { pickLocale } from "@/lib/i18n/localized";
import type { LocalizedText } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RunnerQuestion = {
  id: string;
  type: "single" | "multiple" | "true_false";
  prompt: LocalizedText;
  points: number;
  options: { id: string; label: LocalizedText }[];
};

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.max(0, s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Timed exam runner (spec 2.3): progress bar + answered/remaining, a
 * jump-anywhere question-nav grid (current / answered / flagged / unanswered),
 * per-question type + points badges, a per-question flag to revisit, autosave
 * on change, and a submit confirmation that warns about unanswered questions.
 * The countdown derives from the server's `endsAt`; on expiry it auto-submits.
 */
export function ExamRunner({
  attemptId,
  questions,
  initialAnswers,
  endsAt,
}: {
  attemptId: string;
  questions: RunnerQuestion[];
  initialAnswers: Record<string, string[]>;
  endsAt: number | null;
}) {
  const t = useTranslations("Exam");
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>(initialAnswers);
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [remaining, setRemaining] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const submitRef = useRef<HTMLFormElement>(null);
  const autoSubmitted = useRef(false);

  // Countdown + auto-submit on expiry.
  useEffect(() => {
    if (endsAt == null) return;
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        submitRef.current?.requestSubmit();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const q = questions[index];
  const selected = answers[q.id] ?? [];
  const answeredCount = questions.filter((x) => (answers[x.id] ?? []).length > 0).length;
  const remainingCount = questions.length - answeredCount;
  const pct = Math.round((answeredCount / questions.length) * 100);

  function choose(optionId: string) {
    const next =
      q.type === "multiple"
        ? selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId]
        : [optionId];
    setAnswers((a) => ({ ...a, [q.id]: next }));
    void saveAnswerAction(attemptId, q.id, next);
  }

  function toggleFlag() {
    setFlags((f) => {
      const n = new Set(f);
      if (n.has(q.id)) n.delete(q.id);
      else n.add(q.id);
      return n;
    });
  }

  const isLast = index === questions.length - 1;
  const typeLabel = t(`qType_${q.type}` as "qType_single");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Header: position + timer */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 tabular-nums">
          {t("questionLabel", { current: index + 1, total: questions.length })}
        </p>
        {remaining != null && (
          <p
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium tabular-nums",
              remaining <= 60 ? "bg-danger/10 text-danger" : "bg-navy-100 text-navy-800",
            )}
          >
            {fmt(remaining)}
          </p>
        )}
      </div>

      {/* Progress bar + answered/remaining */}
      <div className="mt-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-slate-500 tabular-nums">
          <span>{t("answered")}: {answeredCount}</span>
          <span>{t("remaining")}: {remainingCount}</span>
        </div>
      </div>

      {/* Question nav pills */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {questions.map((x, i) => {
          const isAnswered = (answers[x.id] ?? []).length > 0;
          const isFlagged = flags.has(x.id);
          const isCurrent = i === index;
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                "relative flex size-8 items-center justify-center rounded-md text-xs font-medium tabular-nums transition-colors",
                isCurrent
                  ? "bg-navy-800 text-white"
                  : isAnswered
                    ? "border border-success/50 bg-success/10 text-success"
                    : "border border-line text-slate-500 hover:border-navy-600",
              )}
            >
              {i + 1}
              {isFlagged && (
                <span className="absolute -right-1 -top-1 size-2 rounded-full bg-gold-500" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {/* Question card */}
      <div className="mt-4 rounded-xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-navy-100 px-2 py-0.5 text-xs font-medium text-navy-800">
              {typeLabel}
            </span>
            <span className="rounded-md bg-line px-2 py-0.5 text-xs font-medium text-slate-500 tabular-nums">
              {t("points")}: {q.points}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleFlag}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium transition-colors",
              flags.has(q.id) ? "text-gold-500" : "text-slate-400 hover:text-navy-600",
            )}
          >
            {flags.has(q.id) ? "★" : "☆"} {flags.has(q.id) ? t("flagged") : t("flag")}
          </button>
        </div>

        <p className="mt-4 font-medium text-ink">{pickLocale(q.prompt, locale)}</p>
        <ul className="mt-4 space-y-2">
          {q.options.map((o) => {
            const on = selected.includes(o.id);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => choose(o.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                    on
                      ? "border-navy-800 bg-navy-100 text-navy-800"
                      : "border-line hover:border-navy-600",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center border",
                      q.type === "multiple" ? "rounded" : "rounded-full",
                      on ? "border-navy-800 bg-navy-800 text-white" : "border-slate-500",
                    )}
                    aria-hidden
                  >
                    {on ? "✓" : ""}
                  </span>
                  {pickLocale(o.label, locale)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          ← {t("prev")}
        </Button>

        {!isLast ? (
          <Button
            type="button"
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
          >
            {t("next")} →
          </Button>
        ) : (
          <Button type="button" onClick={() => setConfirming(true)}>
            {t("submit")}
          </Button>
        )}
      </div>

      {/* Submit confirmation dialog (warns about unanswered) */}
      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-xl">
            <p className="font-medium text-ink">
              {remainingCount > 0
                ? t("unansweredWarn", { count: remainingCount })
                : t("submitConfirm")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                {t("prev")}
              </Button>
              {/* Native submit tied to the hidden form → fires the server action. */}
              <Button type="submit" form="exam-submit-form">
                {t("submit")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden submit form — has a submit button so requestSubmit() (time expiry)
          and the dialog's form-linked button both reliably fire the action. */}
      <form
        id="exam-submit-form"
        ref={submitRef}
        action={submitExamAction.bind(null, attemptId)}
        className="hidden"
      >
        <button type="submit" aria-hidden tabIndex={-1} />
      </form>
    </div>
  );
}

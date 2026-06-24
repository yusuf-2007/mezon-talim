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
  options: { id: string; label: LocalizedText }[];
};

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.max(0, s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * One-question-per-page timed runner. Answers autosave on change (server also
 * enforces the window + ownership). The countdown is derived from the server's
 * `endsAt`; on expiry the attempt auto-submits via the same submit form.
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
  // Set on mount by the countdown effect (avoids Date.now() during render).
  const [remaining, setRemaining] = useState<number | null>(null);
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

  function choose(optionId: string) {
    const next =
      q.type === "multiple"
        ? selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId]
        : [optionId];
    setAnswers((a) => ({ ...a, [q.id]: next }));
    // Fire-and-forget autosave; server re-validates window/ownership.
    void saveAnswerAction(attemptId, q.id, next);
  }

  const isLast = index === questions.length - 1;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 tabular-nums">
          {t("questionLabel", { current: index + 1, total: questions.length })}
        </p>
        {remaining != null && (
          <p
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium tabular-nums",
              remaining <= 30 ? "bg-danger/10 text-danger" : "bg-navy-100 text-navy-800",
            )}
          >
            {fmt(remaining)}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface p-6 shadow-sm">
        <p className="font-medium text-ink">{pickLocale(q.prompt, locale)}</p>
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

      <div className="mt-6 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          ← {t("prev")}
        </Button>

        <div className="flex items-center gap-2">
          {!isLast && (
            <Button
              type="button"
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            >
              {t("next")} →
            </Button>
          )}
          {/* Always rendered so time-expiry auto-submit can call requestSubmit()
              from any question; visible only on the last page. */}
          <form
            ref={submitRef}
            action={submitExamAction.bind(null, attemptId)}
            className={isLast ? "" : "hidden"}
            onSubmit={(e) => {
              if (!autoSubmitted.current && !window.confirm(t("submitConfirm"))) {
                e.preventDefault();
              }
            }}
          >
            <Button type="submit">{t("submit")}</Button>
          </form>
        </div>
      </div>
    </div>
  );
}

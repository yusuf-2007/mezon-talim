"use client";

import { Check, Flag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveAnswerAction, submitExamAction } from "@/lib/assessments/actions";
import { pickLocale } from "@/lib/i18n/localized";
import type { LocalizedText } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { EXAM_SAVE_EVENT, type SaveStatus } from "./exam-clock";

type RunnerQuestion = {
  id: string;
  type: "single" | "multiple" | "true_false";
  prompt: LocalizedText;
  points: number;
  options: { id: string; label: LocalizedText }[];
};

const LETTERS = "ABCDEFGHIJ";

/**
 * The exam itself: a question grid on the left (answered / current / flagged),
 * one question at a time on the right, autosave on every pick.
 *
 * The clock lives in the focus bar (ExamClock); it owns auto-submit on expiry
 * and hears about saves through a window event, so the bar can say "saved"
 * only when the server actually said so.
 */
export function ExamRunner({
  attemptId,
  questions,
  initialAnswers,
}: {
  attemptId: string;
  questions: RunnerQuestion[];
  initialAnswers: Record<string, string[]>;
}) {
  const t = useTranslations("Exam");
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>(initialAnswers);
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const pendingSaves = useRef(0);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setConfirming(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming]);

  const q = questions[index];
  const selected = answers[q.id] ?? [];
  const isAnswered = (id: string) => (answers[id] ?? []).length > 0;
  const answeredCount = questions.filter((x) => isAnswered(x.id)).length;
  const unanswered = questions.length - answeredCount;
  const allAnswered = unanswered === 0;
  const isLast = index === questions.length - 1;

  function announce(status: SaveStatus) {
    window.dispatchEvent(new CustomEvent<SaveStatus>(EXAM_SAVE_EVENT, { detail: status }));
  }

  async function choose(optionId: string) {
    const next =
      q.type === "multiple"
        ? selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId]
        : [optionId];
    setAnswers((a) => ({ ...a, [q.id]: next }));
    pendingSaves.current += 1;
    announce("saving");
    let ok = false;
    try {
      ok = (await saveAnswerAction(attemptId, q.id, next)).ok;
    } catch {
      ok = false;
    }
    pendingSaves.current -= 1;
    if (!ok) announce("error");
    else if (pendingSaves.current === 0) announce("saved");
  }

  function toggleFlag() {
    setFlags((f) => {
      const n = new Set(f);
      if (n.has(q.id)) n.delete(q.id);
      else n.add(q.id);
      return n;
    });
  }

  const flagged = flags.has(q.id);

  return (
    <div className="mx-auto grid max-w-[1080px] items-start gap-7 px-5 pb-20 pt-8 sm:px-7 lg:grid-cols-[220px_minmax(0,1fr)]">
      {/* ── Question grid ──────────────────────────────────────────── */}
      <aside className="rounded-[14px] border border-lp-line bg-white p-[18px] lg:sticky lg:top-[84px]">
        <p className="mb-3 text-[.74rem] font-bold uppercase tracking-[.14em] text-lp-muted">
          {t("questionsNav")}
        </p>
        <div className="grid grid-cols-6 gap-2 lg:grid-cols-4">
          {questions.map((x, i) => {
            const current = i === index;
            const done = isAnswered(x.id);
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-current={current ? "step" : undefined}
                aria-label={t("questionOf", { current: i + 1, total: questions.length })}
                className={cn(
                  "relative grid aspect-square place-items-center rounded-[9px] border-[1.5px] text-[.9rem] font-bold tabular-nums transition-colors",
                  current
                    ? "border-lp-gold bg-white text-lp-navy"
                    : done
                      ? "border-lp-navy bg-lp-navy text-white"
                      : "border-lp-line bg-lp-wash-alt text-lp-muted hover:border-lp-navy",
                )}
              >
                {i + 1}
                {flags.has(x.id) && (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-1 size-[9px] rounded-full border-[1.5px] border-white bg-lp-danger"
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-col gap-1.5 border-t border-lp-line-soft pt-3.5 text-[.8rem] text-lp-slate tabular-nums">
          <span>
            {t.rich("answeredOf", {
              answered: answeredCount,
              total: questions.length,
              b: (c) => <b className="text-lp-ink">{c}</b>,
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-lp-danger" />
            {t("flaggedLegend")}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={cn(
            "mt-4 w-full rounded-[10px] p-[11px] text-center text-[.9rem] font-bold transition",
            allAnswered
              ? "bg-lp-gold text-lp-navy-deep hover:shadow-[0_6px_18px_rgba(248,184,1,.35)]"
              : "bg-lp-line-soft text-lp-slate hover:bg-lp-line",
          )}
        >
          {t("submit")}
        </button>
      </aside>

      {/* ── Question ───────────────────────────────────────────────── */}
      <main className="min-w-0">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <span className="text-[.8rem] font-bold uppercase tracking-[.1em] text-lp-gold-deep tabular-nums">
            {t("questionOf", { current: index + 1, total: questions.length })}
          </span>
          <button
            type="button"
            onClick={toggleFlag}
            aria-pressed={flagged}
            className={cn(
              "inline-flex items-center gap-1.5 text-[.82rem] font-bold transition-colors",
              flagged ? "text-lp-danger" : "text-lp-muted hover:text-lp-navy",
            )}
          >
            <Flag className={cn("size-3.5", flagged && "fill-current")} strokeWidth={2} />
            {flagged ? t("flagged") : t("flagLater")}
          </button>
        </div>

        <div className="rounded-2xl border border-lp-line bg-white px-6 py-7 shadow-[0_2px_10px_rgba(2,58,105,.05)] sm:px-[30px]">
          <h2 className="font-lp-heading text-[1.5rem] font-medium leading-[1.35] text-lp-ink">
            {pickLocale(q.prompt, locale)}
          </h2>
          {q.type === "multiple" && (
            <p className="mt-2 text-[.85rem] text-lp-muted">{t("multipleHint")}</p>
          )}
          <div className="mt-6 flex flex-col gap-2.5">
            {q.options.map((o, i) => {
              const on = selected.includes(o.id);
              const label = pickLocale(o.label, locale);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => void choose(o.id)}
                  aria-pressed={on}
                  aria-label={label}
                  className={cn(
                    "grid grid-cols-[32px_1fr] items-center gap-3.5 rounded-[11px] border-[1.5px] px-4 py-3.5 text-left transition-colors",
                    on ? "border-lp-navy bg-lp-wash" : "border-lp-line bg-white hover:border-lp-line-strong",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-[30px] place-items-center border-[1.5px] text-[.82rem] font-extrabold",
                      q.type === "multiple" ? "rounded-[8px]" : "rounded-full",
                      on ? "border-lp-navy bg-lp-navy text-white" : "border-lp-line-strong bg-white text-lp-slate",
                    )}
                  >
                    {q.type === "multiple" && on ? <Check className="size-3.5" strokeWidth={3} /> : LETTERS[i]}
                  </span>
                  <span className="text-[1.05rem] leading-[1.45] text-lp-ink">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-[18px] flex justify-between gap-3">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="rounded-[10px] border-[1.5px] border-lp-line bg-white px-4 py-[11px] text-[.92rem] font-bold text-lp-navy transition-colors hover:bg-lp-wash disabled:opacity-40"
          >
            ← {t("prev")}
          </button>
          <button
            type="button"
            onClick={() =>
              isLast ? setConfirming(true) : setIndex((i) => Math.min(questions.length - 1, i + 1))
            }
            className="rounded-[10px] bg-lp-navy px-5 py-3 text-[.92rem] font-bold text-white transition-colors hover:bg-lp-navy-deep"
          >
            {isLast ? t("submit") : `${t("next")} →`}
          </button>
        </div>
      </main>

      {/* ── Submit confirmation ────────────────────────────────────── */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-lp-navy-deep/50 p-4"
          onClick={(e) => e.target === e.currentTarget && setConfirming(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-lp-line bg-white p-6 shadow-[0_20px_50px_rgba(1,20,40,.25)]"
          >
            <p className="font-semibold text-lp-ink">
              {unanswered > 0 ? t("unansweredWarn", { count: unanswered }) : t("submitConfirm")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-[10px] border-[1.5px] border-lp-line bg-white px-4 py-2.5 text-[.9rem] font-bold text-lp-navy hover:bg-lp-wash"
              >
                {t("cancel")}
              </button>
              {/* Native submit tied to the hidden form → fires the server action. */}
              <button
                type="submit"
                form="exam-submit-form"
                className="rounded-[10px] bg-lp-gold px-4 py-2.5 text-[.9rem] font-bold text-lp-navy-deep"
              >
                {t("submit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden submit form — has a submit button so requestSubmit() (time
          expiry, from ExamClock) and the dialog's button both fire the action. */}
      <form id="exam-submit-form" action={submitExamAction.bind(null, attemptId)} className="hidden">
        <button type="submit" aria-hidden tabIndex={-1} />
      </form>
    </div>
  );
}

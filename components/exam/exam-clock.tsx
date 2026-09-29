"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const EXAM_SAVE_EVENT = "mezon:exam-save";
export type SaveStatus = "saving" | "saved" | "error";

function fmt(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * The right side of the focus bar during an exam: save status and the clock.
 *
 * The countdown derives from the server's `endsAt`, so reloading does not buy
 * time; at zero it submits the runner's hidden form. Save status starts as
 * "saved" because answers already on the server were loaded with the page.
 */
export function ExamClock({ endsAt }: { endsAt: number | null }) {
  const t = useTranslations("Exam");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const fired = useRef(false);

  useEffect(() => {
    const on = (e: Event) => setStatus((e as CustomEvent<SaveStatus>).detail);
    window.addEventListener(EXAM_SAVE_EVENT, on);
    return () => window.removeEventListener(EXAM_SAVE_EVENT, on);
  }, []);

  useEffect(() => {
    if (endsAt == null) return;
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !fired.current) {
        fired.current = true;
        (document.getElementById("exam-submit-form") as HTMLFormElement | null)?.requestSubmit();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <>
      <span
        aria-live="polite"
        className="hidden items-center gap-1.5 text-[.8rem] text-lp-on-navy-dim md:inline-flex"
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            status === "saved" ? "bg-lp-success-dot" : status === "saving" ? "bg-lp-gold" : "bg-lp-danger",
          )}
        />
        {status === "saved" ? t("saved") : status === "saving" ? t("saving") : t("saveFailed")}
      </span>
      {remaining != null && (
        <span
          role="timer"
          aria-label={t("timeLeft")}
          className={cn(
            "inline-flex items-center gap-[7px] rounded-[8px] px-3 py-1.5 text-[.95rem] font-extrabold tabular-nums",
            remaining <= 60 ? "bg-lp-danger text-white" : "bg-lp-gold-light text-lp-navy-deep",
          )}
        >
          <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2 2M9 2h6" />
          </svg>
          {fmt(remaining)}
        </span>
      )}
    </>
  );
}

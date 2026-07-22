"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { setPollVariantAction } from "@/lib/audience/actions";

type Variant = "corner" | "modal_blur" | "modal_clear";
const VARIANTS: Variant[] = ["modal_clear", "modal_blur", "corner"];

/** A tiny illustrative mock of how each treatment sits on the page. */
function Preview({ variant }: { variant: Variant }) {
  const page = (
    <div className="space-y-1 p-2">
      <div className="h-1.5 w-2/3 rounded-full bg-slate-300" />
      <div className="h-1.5 w-full rounded-full bg-slate-200" />
      <div className="h-1.5 w-4/5 rounded-full bg-slate-200" />
    </div>
  );
  const chip = (
    <div className="rounded-md border border-line bg-surface px-1.5 py-1 shadow-sm">
      <div className="mx-auto h-1 w-8 rounded-full bg-navy-600/50" />
      <div className="mt-1 flex justify-center gap-0.5">
        <div className="h-1.5 w-3 rounded-sm bg-navy-100" />
        <div className="h-1.5 w-3 rounded-sm bg-navy-100" />
        <div className="h-1.5 w-3 rounded-sm bg-navy-100" />
      </div>
    </div>
  );

  return (
    <div className="relative h-20 w-full overflow-hidden rounded-lg border border-line bg-bg">
      {page}
      {variant !== "corner" && (
        <div
          className={cn(
            "absolute inset-0 grid place-items-center bg-navy-900/40",
            variant === "modal_blur" && "backdrop-blur-[2px]",
          )}
        >
          <div className="w-3/5">{chip}</div>
        </div>
      )}
      {variant === "corner" && (
        <div className="absolute bottom-1.5 right-1.5 w-2/5">{chip}</div>
      )}
    </div>
  );
}

/**
 * Super-admin control to switch the live entry-poll's appearance. Selecting a
 * card persists immediately (audited server-side) and takes effect for new
 * visitors within ~a minute (the config endpoint is short-cached).
 */
export function PollVariantControl({ current }: { current: Variant }) {
  const t = useTranslations("Admin");
  const [selected, setSelected] = useState<Variant>(current);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function choose(v: Variant) {
    if (v === selected || pending) return;
    const prev = selected;
    setSelected(v);
    setError(false);
    startTransition(async () => {
      try {
        await setPollVariantAction(v);
      } catch {
        setSelected(prev);
        setError(true);
      }
    });
  }

  const LABELS: Record<Variant, { title: string; desc: string }> = {
    modal_clear: { title: t("pollModalClear"), desc: t("pollModalClearSub") },
    modal_blur: { title: t("pollModalBlur"), desc: t("pollModalBlurSub") },
    corner: { title: t("pollCorner"), desc: t("pollCornerSub") },
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-navy-800">
            {t("pollAppearanceTitle")}
          </h2>
          <p className="text-xs text-slate-500">{t("pollAppearanceSub")}</p>
        </div>
        <span
          aria-live="polite"
          className={cn(
            "shrink-0 text-xs",
            pending ? "text-slate-400" : error ? "text-danger" : "text-success",
          )}
        >
          {pending ? t("pollSaving") : error ? t("pollSaveError") : t("pollSaved")}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {VARIANTS.map((v) => {
          const active = selected === v;
          return (
            <button
              key={v}
              type="button"
              data-variant={v}
              onClick={() => choose(v)}
              aria-pressed={active}
              disabled={pending}
              className={cn(
                "rounded-xl border-2 p-3 text-left transition-colors disabled:opacity-70",
                active
                  ? "border-navy-800 bg-navy-100/40"
                  : "border-line hover:border-navy-600",
              )}
            >
              <Preview variant={v} />
              <div className="mt-2 flex items-center gap-1.5">
                <span
                  className={cn(
                    "grid h-4 w-4 place-items-center rounded-full border",
                    active ? "border-navy-800 bg-navy-800 text-white" : "border-slate-300",
                  )}
                >
                  {active && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M5 13l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="text-sm font-medium text-ink">{LABELS[v].title}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{LABELS[v].desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

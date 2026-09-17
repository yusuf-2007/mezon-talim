"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setApplicationStatusAction } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";

const STATUSES = ["new", "contacted", "enrolled", "declined"] as const;

/** The funnel's colour language, so the table reads without being read. */
const TONE: Record<(typeof STATUSES)[number], string> = {
  new: "bg-lp-gold-tint text-lp-gold-ink border-lp-gold-band",
  contacted: "bg-lp-tint text-lp-navy border-lp-line",
  enrolled: "bg-lp-success-tint text-lp-success border-lp-success-dot/30",
  declined: "bg-lp-line-soft text-lp-muted border-lp-line",
};

/**
 * Inline status changer for the applications table.
 *
 * Optimistic: the pill changes colour the moment it is picked, because the
 * person doing this is working down a call list and should not wait on a round
 * trip between numbers. A failure puts the old value back.
 */
export function ApplicationStatusSelect({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const t = useTranslations("Admin");
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    start(async () => {
      try {
        await setApplicationStatusAction(applicationId, next);
      } catch {
        setValue(prev);
      }
    });
  }

  const tone = TONE[value as (typeof STATUSES)[number]] ?? TONE.new;

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t("appsColStatus")}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-1 text-[.74rem] font-bold outline-none transition-colors disabled:opacity-60",
        tone,
      )}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s} className="bg-surface text-lp-ink">
          {t(`appStatus_${s}`)}
        </option>
      ))}
    </select>
  );
}

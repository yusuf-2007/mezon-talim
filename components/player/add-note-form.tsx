"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getVideoTime } from "./video-time-store";

type Action = (prev: { ok: boolean }, fd: FormData) => Promise<{ ok: boolean }>;

/** 5405 → "1:30:05"; 90 → "1:30". Mirrors the list's chip format. */
function formatSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** "111130" → "11:11:30", "130" → "1:30" — digits grouped in twos from the right. */
function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  const groups: string[] = [];
  let rest = digits;
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return groups.join(":");
}

/**
 * Merged note form (B7 + B8): a note with an optional video timestamp. The
 * time is typed as mm:ss / hh:mm:ss (parsed server-side), or captured from
 * the live playhead via the "current time" checkbox.
 */
export function AddNoteForm({ action }: { action: Action }) {
  const t = useTranslations("Player");
  const ref = useRef<HTMLFormElement>(null);
  const [time, setTime] = useState("");
  const [useCurrent, setUseCurrent] = useState(false);
  const [, formAction, pending] = useActionState(
    async (prev: { ok: boolean }, fd: FormData) => {
      const res = await action(prev, fd);
      if (res.ok) {
        ref.current?.reset();
        setTime("");
        setUseCurrent(false);
      }
      return res;
    },
    { ok: false },
  );

  function toggleCurrent(checked: boolean) {
    setUseCurrent(checked);
    if (checked) setTime(formatSeconds(getVideoTime()));
  }

  return (
    <form
      ref={ref}
      action={formAction}
      className="rounded-xl border border-lp-line bg-white p-3.5"
    >
      <textarea
        name="body"
        rows={3}
        required
        placeholder={t("notePlaceholder")}
        className="block min-h-[60px] w-full resize-y border-0 bg-transparent px-0.5 py-1 text-[.92rem] text-lp-ink outline-none placeholder:text-lp-muted-light"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-lp-line-soft pt-2.5">
        <span className="flex flex-wrap items-center gap-2">
          {/* The time this note is pinned to. Typed as mm:ss, or taken from the
              playhead with one tap. */}
          <label className="inline-flex items-center gap-1.5 rounded-full bg-lp-tint px-2.5 py-1 text-[.8rem] font-bold text-lp-navy">
            <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <input
              name="timestamp"
              value={time}
              onChange={(e) => {
                setUseCurrent(false);
                setTime(maskTime(e.target.value));
              }}
              placeholder="00:00"
              aria-label={t("noteTimestamp")}
              pattern="^\d{1,4}(:[0-5]?\d){0,2}$"
              title="00:00:00"
              inputMode="numeric"
              className="w-[4.8rem] bg-transparent tabular-nums outline-none placeholder:text-lp-navy/40"
            />
            <span className="font-semibold">{t("noteAnchored")}</span>
          </label>
          <button
            type="button"
            onClick={() => toggleCurrent(!useCurrent)}
            aria-pressed={useCurrent}
            className="text-[.8rem] font-bold text-lp-navy-mid hover:underline"
          >
            {t("useCurrentTime")}
          </button>
        </span>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[9px] bg-lp-navy px-4 py-[9px] text-[.84rem] font-bold text-white transition-opacity disabled:opacity-60"
        >
          {t("addNote")}
        </button>
      </div>
    </form>
  );
}

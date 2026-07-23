"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
    <form ref={ref} action={formAction} className="space-y-2">
      <Textarea name="body" rows={3} placeholder={t("notePlaceholder")} required />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Input
          name="timestamp"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="00:00:00"
          aria-label={t("noteTimestamp")}
          pattern="^\d{1,4}(:[0-5]?\d){0,2}$"
          title="00:00:00"
          inputMode="numeric"
          readOnly={useCurrent}
          className="w-28 tabular-nums"
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-500">
          <input
            type="checkbox"
            checked={useCurrent}
            onChange={(e) => toggleCurrent(e.target.checked)}
            className="size-4 accent-navy-800"
          />
          {t("useCurrentTime")}
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {t("addNote")}
        </Button>
      </div>
    </form>
  );
}

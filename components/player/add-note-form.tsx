"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Action = (prev: { ok: boolean }, fd: FormData) => Promise<{ ok: boolean }>;

/**
 * Merged note form (B7 + B8): a note with an optional video timestamp — what
 * used to be a separate "bookmark".
 */
export function AddNoteForm({ action }: { action: Action }) {
  const t = useTranslations("Player");
  const ref = useRef<HTMLFormElement>(null);
  const [, formAction, pending] = useActionState(
    async (prev: { ok: boolean }, fd: FormData) => {
      const res = await action(prev, fd);
      if (res.ok) ref.current?.reset();
      return res;
    },
    { ok: false },
  );

  return (
    <form ref={ref} action={formAction} className="space-y-2">
      <Textarea name="body" rows={3} placeholder={t("notePlaceholder")} required />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="timestampSeconds"
          type="number"
          min={0}
          placeholder={t("noteTimestamp")}
          className="w-40 tabular-nums"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {t("addNote")}
        </Button>
      </div>
    </form>
  );
}

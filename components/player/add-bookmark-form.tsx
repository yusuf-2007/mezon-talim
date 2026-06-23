"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Action = (prev: { ok: boolean }, fd: FormData) => Promise<{ ok: boolean }>;

export function AddBookmarkForm({ action }: { action: Action }) {
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
    <form ref={ref} action={formAction} className="flex flex-wrap items-end gap-2">
      <Input name="label" placeholder={t("bookmarkLabel")} className="flex-1" />
      <Input
        name="timestampSeconds"
        type="number"
        min={0}
        placeholder="0:00 (s)"
        className="w-28 tabular-nums"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("addBookmark")}
      </Button>
    </form>
  );
}

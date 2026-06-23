"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { ContentFormState } from "@/lib/content/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmSubmit } from "./confirm-submit";

type Action = (prev: ContentFormState, fd: FormData) => Promise<ContentFormState>;

const initial: ContentFormState = {};

/** Module title with inline rename + delete. */
export function ModuleHeader({
  title,
  index,
  updateAction,
  deleteAction,
}: {
  title: { uz: string; ru?: string };
  index: number;
  updateAction: Action;
  deleteAction: () => Promise<void>;
}) {
  const t = useTranslations("Studio");
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: ContentFormState, fd: FormData) => {
      const res = await updateAction(prev, fd);
      if (!res.fieldErrors && !res.error) setEditing(false);
      return res;
    },
    initial,
  );

  if (editing) {
    return (
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <Input name="titleUz" defaultValue={title.uz} required />
          {state.fieldErrors?.titleUz && (
            <p className="mt-1 text-sm text-danger">{state.fieldErrors.titleUz[0]}</p>
          )}
        </div>
        <Input name="titleRu" defaultValue={title.ru ?? ""} placeholder="RU" className="flex-1" />
        <Button type="submit" size="sm" disabled={pending}>
          {t("save")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          {t("cancel")}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-heading text-lg font-semibold text-navy-800">
        <span className="mr-2 text-slate-500 tabular-nums">{index + 1}.</span>
        {title.uz}
      </h3>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          {t("edit")}
        </Button>
        <form action={deleteAction}>
          <ConfirmSubmit label={t("delete")} />
        </form>
      </div>
    </div>
  );
}

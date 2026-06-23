"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ContentFormState } from "@/lib/content/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field } from "./field";
import { FormError } from "@/components/auth/form-bits";

type LessonLike = {
  title: { uz: string; ru?: string };
  body?: { uz: string; ru?: string } | null;
  bunnyVideoId?: string | null;
  durationSeconds?: number | null;
  isPreview: boolean;
};

const initial: ContentFormState = {};

/**
 * Lesson create/edit form. In "create" mode it resets and collapses on success;
 * in "edit" mode it stays open. `action` is a bound server action.
 */
export function LessonForm({
  action,
  lesson,
  mode,
  onDone,
}: {
  action: (prev: ContentFormState, fd: FormData) => Promise<ContentFormState>;
  lesson?: LessonLike;
  mode: "create" | "edit";
  onDone?: () => void;
}) {
  const t = useTranslations("Studio");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: ContentFormState, fd: FormData) => {
      const res = await action(prev, fd);
      if (!res.fieldErrors && !res.error) {
        if (mode === "create") formRef.current?.reset();
        onDone?.();
      }
      return res;
    },
    initial,
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-lg border border-line bg-bg p-4">
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("titleUz")} errors={state.fieldErrors?.titleUz}>
          <Input name="titleUz" defaultValue={lesson?.title.uz} required />
        </Field>
        <Field label={t("titleRu")}>
          <Input name="titleRu" defaultValue={lesson?.title.ru ?? ""} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("bunnyVideoId")} hint={t("bunnyHint")}>
          <Input name="bunnyVideoId" defaultValue={lesson?.bunnyVideoId ?? ""} />
        </Field>
        <Field label={t("durationSeconds")}>
          <Input
            name="durationSeconds"
            type="number"
            min={0}
            defaultValue={lesson?.durationSeconds ?? ""}
            className="tabular-nums"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("lessonBodyUz")}>
          <Textarea name="bodyUz" rows={3} defaultValue={lesson?.body?.uz ?? ""} />
        </Field>
        <Field label={t("lessonBodyRu")}>
          <Textarea name="bodyRu" rows={3} defaultValue={lesson?.body?.ru ?? ""} />
        </Field>
      </div>

      <label className="flex items-center gap-3">
        <Switch name="isPreview" value="true" defaultChecked={lesson?.isPreview ?? false} />
        <span className="text-sm">{t("isPreview")}</span>
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {mode === "create" ? t("addLesson") : t("save")}
        </Button>
        {mode === "edit" && onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            {t("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Collapsible wrapper so an editor only renders when opened. */
export function Collapsible({
  trigger,
  children,
}: {
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger(open, () => setOpen((o) => !o))}
      {open && children(() => setOpen(false))}
    </>
  );
}

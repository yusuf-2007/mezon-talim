"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AssessFormState } from "@/lib/assessments/studio-actions";
import { pickLocale } from "@/lib/i18n/localized";
import type { LocalizedText } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "./field";
import { ConfirmSubmit } from "./confirm-submit";
import { FormError } from "@/components/auth/form-bits";

type QType = "single" | "multiple" | "true_false";
type OptionRow = { uz: string; ru: string; correct: boolean };
type ModuleOption = { id: string; title: LocalizedText };
type QuestionLike = {
  type: QType;
  prompt: LocalizedText;
  explanation: LocalizedText | null;
  points?: number;
  moduleId?: string | null;
  options: { label: LocalizedText; isCorrect: boolean }[];
};
type Action = (prev: AssessFormState, fd: FormData) => Promise<AssessFormState>;

const QTYPES: QType[] = ["single", "multiple", "true_false"];
const selectCls = "h-9 w-full rounded-md border border-line bg-surface px-3 text-sm";

function initialOptions(q?: QuestionLike): OptionRow[] {
  if (q && q.options.length) {
    return q.options.map((o) => ({ uz: o.label.uz, ru: o.label.ru ?? "", correct: o.isCorrect }));
  }
  return [
    { uz: "", ru: "", correct: false },
    { uz: "", ru: "", correct: false },
  ];
}

export function QuestionEditor({
  action,
  question,
  mode,
  modules = [],
  onDone,
}: {
  action: Action;
  question?: QuestionLike;
  mode: "create" | "edit";
  modules?: ModuleOption[];
  onDone?: () => void;
}) {
  const t = useTranslations("Assess");
  const locale = useLocale();
  const [options, setOptions] = useState<OptionRow[]>(() => initialOptions(question));
  const [state, formAction, pending] = useActionState(
    async (prev: AssessFormState, fd: FormData) => {
      const res = await action(prev, fd);
      if (!res.error && !res.fieldErrors) {
        if (mode === "create") setOptions(initialOptions());
        onDone?.();
      }
      return res;
    },
    {},
  );

  const setOpt = (i: number, patch: Partial<OptionRow>) =>
    setOptions((os) => os.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-line bg-bg p-4">
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <Field label={t("qType")}>
          <select name="type" defaultValue={question?.type ?? "single"} className={selectCls}>
            {QTYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`qType_${ty}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("prompt")} errors={state.fieldErrors?.promptUz}>
          <Input name="promptUz" defaultValue={question?.prompt.uz} required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem_6rem]">
        <Field label={t("promptRu")}>
          <Input name="promptRu" defaultValue={question?.prompt.ru ?? ""} />
        </Field>
        <Field label={t("questionModule")}>
          <select
            name="moduleId"
            defaultValue={question?.moduleId ?? ""}
            className={selectCls}
          >
            <option value="">{t("noModule")}</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {pickLocale(m.title, locale)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("points")}>
          <Input
            name="points"
            type="number"
            min={1}
            defaultValue={question?.points ?? 1}
            className="tabular-nums"
          />
        </Field>
      </div>

      {/* Options */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-navy-800">{t("options")}</p>
        {options.map((o, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input
                type="checkbox"
                name="correct"
                value={i}
                checked={o.correct}
                onChange={(e) => setOpt(i, { correct: e.target.checked })}
              />
              {t("markCorrect")}
            </label>
            <input
              name="optionUz"
              value={o.uz}
              onChange={(e) => setOpt(i, { uz: e.target.value })}
              placeholder={t("optionPlaceholder")}
              className="h-9 flex-1 rounded-md border border-line bg-surface px-3 text-sm"
            />
            <input
              name="optionRu"
              value={o.ru}
              onChange={(e) => setOpt(i, { ru: e.target.value })}
              placeholder="RU"
              className="h-9 flex-1 rounded-md border border-line bg-surface px-3 text-sm"
            />
            {options.length > 2 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOptions((os) => os.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOptions((os) => [...os, { uz: "", ru: "", correct: false }])}
        >
          + {t("addOption")}
        </Button>
      </div>

      <Field label={t("explanation")}>
        <Textarea name="explanationUz" rows={2} defaultValue={question?.explanation?.uz ?? ""} />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {mode === "create" ? t("addQuestion") : t("save")}
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

export function AddQuestion({
  action,
  modules = [],
}: {
  action: Action;
  modules?: ModuleOption[];
}) {
  const t = useTranslations("Assess");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        + {t("addQuestion")}
      </Button>
    );
  }
  return (
    <QuestionEditor
      action={action}
      mode="create"
      modules={modules}
      onDone={() => setOpen(false)}
    />
  );
}

export function QuestionRow({
  index,
  question,
  modules = [],
  updateAction,
  deleteAction,
}: {
  index: number;
  question: QuestionLike;
  modules?: ModuleOption[];
  updateAction: Action;
  deleteAction: () => Promise<void>;
}) {
  const t = useTranslations("Assess");
  const locale = useLocale();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <QuestionEditor
          action={updateAction}
          question={question}
          mode="edit"
          modules={modules}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">
            <span className="mr-2 tabular-nums text-slate-500">{index + 1}.</span>
            {pickLocale(question.prompt, locale)}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {question.options.map((o, i) => (
              <li key={i} className="text-xs text-slate-500">
                {o.isCorrect ? "✓ " : "• "}
                {pickLocale(o.label, locale)}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {t("editQuestion")}
          </Button>
          <form action={deleteAction}>
            <ConfirmSubmit label={t("delete")} />
          </form>
        </div>
      </div>
    </li>
  );
}

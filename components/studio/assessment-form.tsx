"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AssessFormState } from "@/lib/assessments/studio-actions";
import { pickLocale } from "@/lib/i18n/localized";
import type { LocalizedText } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field } from "./field";
import { FormError } from "@/components/auth/form-bits";

type Opt = { id: string; title: LocalizedText };
type AssessmentLike = {
  type: "lesson_quiz" | "module_test" | "final_exam" | "mock_exam";
  title: LocalizedText;
  moduleId: string | null;
  lessonId: string | null;
  timeLimitSeconds: number | null;
  passThresholdPct: number;
  maxAttempts: number | null;
  attemptCooldownHours: number | null;
  isScored: boolean;
  randomize: boolean;
};

const TYPES = ["lesson_quiz", "module_test", "final_exam", "mock_exam"] as const;
const selectCls =
  "h-9 w-full rounded-md border border-line bg-surface px-3 text-sm";

export function AssessmentForm({
  action,
  submitLabel,
  modules,
  lessons,
  assessment,
}: {
  action: (prev: AssessFormState, fd: FormData) => Promise<AssessFormState>;
  submitLabel: string;
  modules: Opt[];
  lessons: Opt[];
  assessment?: AssessmentLike;
}) {
  const t = useTranslations("Assess");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(action, {});
  const [type, setType] = useState<AssessmentLike["type"]>(
    assessment?.type ?? "lesson_quiz",
  );

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("type")}>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as AssessmentLike["type"])}
            className={selectCls}
          >
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`type_${ty}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("name")} errors={state.fieldErrors?.titleUz}>
          <Input name="titleUz" defaultValue={assessment?.title.uz} required />
        </Field>
      </div>

      <Field label={`${t("name")} (RU)`}>
        <Input name="titleRu" defaultValue={assessment?.title.ru ?? ""} />
      </Field>

      {type === "module_test" && (
        <Field label={t("module")}>
          <select name="moduleId" defaultValue={assessment?.moduleId ?? ""} className={selectCls}>
            <option value="">{t("none")}</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {pickLocale(m.title, locale)}
              </option>
            ))}
          </select>
        </Field>
      )}
      {type === "lesson_quiz" && (
        <Field label={t("lesson")}>
          <select name="lessonId" defaultValue={assessment?.lessonId ?? ""} className={selectCls}>
            <option value="">{t("none")}</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {pickLocale(l.title, locale)}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("timeLimit")}>
          <Input
            name="timeLimitMinutes"
            type="number"
            min={0}
            placeholder={t("untimed")}
            defaultValue={assessment?.timeLimitSeconds ? assessment.timeLimitSeconds / 60 : ""}
            className="tabular-nums"
          />
        </Field>
        <Field label={t("passThreshold")}>
          <Input
            name="passThresholdPct"
            type="number"
            min={1}
            max={100}
            defaultValue={assessment?.passThresholdPct ?? 70}
            className="tabular-nums"
          />
        </Field>
        <Field label={t("maxAttempts")}>
          <Input
            name="maxAttempts"
            type="number"
            min={0}
            placeholder={t("unlimited")}
            defaultValue={assessment?.maxAttempts ?? ""}
            className="tabular-nums"
          />
        </Field>
        <Field label={t("cooldown")}>
          <Input
            name="attemptCooldownHours"
            type="number"
            min={0}
            placeholder="0"
            defaultValue={assessment?.attemptCooldownHours ?? ""}
            className="tabular-nums"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-3">
          <Switch name="isScored" value="true" defaultChecked={assessment?.isScored ?? true} />
          <span className="text-sm">{t("scored")}</span>
        </label>
        <label className="flex items-center gap-3">
          <Switch name="randomize" value="true" defaultChecked={assessment?.randomize ?? false} />
          <span className="text-sm">{t("randomize")}</span>
        </label>
      </div>

      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}

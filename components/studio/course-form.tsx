"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { ContentFormState } from "@/lib/content/actions";
import { tiyinToSom } from "@/lib/content/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field } from "./field";
import { FormError } from "@/components/auth/form-bits";

type CourseLike = {
  slug: string;
  title: { uz: string; ru?: string };
  summary?: { uz: string; ru?: string } | null;
  description?: { uz: string; ru?: string } | null;
  coverUrl?: string | null;
  category?: string | null;
  priceTiyin: number;
  accessDurationDays: number;
  passThresholdPct: number;
  certificateEnabled: boolean;
};

const initial: ContentFormState = {};

/**
 * Shared create/edit course form. `action` is a bound server action returning
 * ContentFormState; `submitLabel` differs between create and save.
 */
export function CourseForm({
  action,
  course,
  submitLabel,
}: {
  action: (prev: ContentFormState, fd: FormData) => Promise<ContentFormState>;
  course?: CourseLike;
  submitLabel: string;
}) {
  const t = useTranslations("Studio");
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("titleUz")} htmlFor="titleUz" errors={state.fieldErrors?.titleUz}>
          <Input id="titleUz" name="titleUz" defaultValue={course?.title.uz} required />
        </Field>
        <Field label={t("titleRu")} htmlFor="titleRu">
          <Input id="titleRu" name="titleRu" defaultValue={course?.title.ru ?? ""} />
        </Field>
      </div>

      <Field
        label={t("slug")}
        htmlFor="slug"
        hint={t("slugHint")}
        errors={state.fieldErrors?.slug}
      >
        <Input id="slug" name="slug" defaultValue={course?.slug} placeholder="aaoifi-asoslari" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("summaryUz")} htmlFor="summaryUz">
          <Textarea id="summaryUz" name="summaryUz" rows={2} defaultValue={course?.summary?.uz ?? ""} />
        </Field>
        <Field label={t("summaryRu")} htmlFor="summaryRu">
          <Textarea id="summaryRu" name="summaryRu" rows={2} defaultValue={course?.summary?.ru ?? ""} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("descriptionUz")} htmlFor="descriptionUz">
          <Textarea id="descriptionUz" name="descriptionUz" rows={4} defaultValue={course?.description?.uz ?? ""} />
        </Field>
        <Field label={t("descriptionRu")} htmlFor="descriptionRu">
          <Textarea id="descriptionRu" name="descriptionRu" rows={4} defaultValue={course?.description?.ru ?? ""} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("coverUrl")} htmlFor="coverUrl" errors={state.fieldErrors?.coverUrl}>
          <Input id="coverUrl" name="coverUrl" type="url" defaultValue={course?.coverUrl ?? ""} />
        </Field>
        <Field label={t("category")} htmlFor="category">
          <Input id="category" name="category" defaultValue={course?.category ?? ""} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label={t("priceSom")} htmlFor="priceSom" errors={state.fieldErrors?.priceSom}>
          <Input
            id="priceSom"
            name="priceSom"
            type="number"
            min={0}
            step={1000}
            defaultValue={course ? tiyinToSom(course.priceTiyin) : 0}
            className="tabular-nums"
          />
        </Field>
        <Field label={t("accessDuration")} htmlFor="accessDurationDays">
          <Input
            id="accessDurationDays"
            name="accessDurationDays"
            type="number"
            min={1}
            defaultValue={course?.accessDurationDays ?? 365}
            className="tabular-nums"
          />
        </Field>
        <Field label={t("passThreshold")} htmlFor="passThresholdPct">
          <Input
            id="passThresholdPct"
            name="passThresholdPct"
            type="number"
            min={1}
            max={100}
            defaultValue={course?.passThresholdPct ?? 70}
            className="tabular-nums"
          />
        </Field>
      </div>

      <label className="flex items-center gap-3">
        <Switch
          name="certificateEnabled"
          value="true"
          defaultChecked={course?.certificateEnabled ?? true}
        />
        <span className="text-sm">{t("certificateEnabled")}</span>
      </label>

      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}

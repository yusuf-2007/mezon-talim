"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import type { ContentFormState } from "@/lib/content/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: ContentFormState = {};

export function AddModuleForm({
  action,
}: {
  action: (prev: ContentFormState, fd: FormData) => Promise<ContentFormState>;
}) {
  const t = useTranslations("Studio");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: ContentFormState, fd: FormData) => {
      const res = await action(prev, fd);
      if (!res.fieldErrors && !res.error) formRef.current?.reset();
      return res;
    },
    initial,
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-start gap-2">
      <div className="flex-1">
        <Input name="titleUz" placeholder={t("moduleTitle")} required />
        {state.fieldErrors?.titleUz && (
          <p className="mt-1 text-sm text-danger">{state.fieldErrors.titleUz[0]}</p>
        )}
      </div>
      <Input name="titleRu" placeholder={`${t("moduleTitle")} (RU)`} className="flex-1" />
      <Button type="submit" variant="outline" disabled={pending}>
        {t("addModule")}
      </Button>
    </form>
  );
}

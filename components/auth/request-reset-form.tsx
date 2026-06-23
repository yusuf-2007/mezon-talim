"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestResetAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormSuccess } from "./form-bits";

const initial: AuthFormState = {};

export function RequestResetForm() {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(requestResetAction, initial);

  return (
    <form action={action} className="space-y-4">
      {state.ok && <FormSuccess message={state.message} />}
      <div>
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError errors={state.fieldErrors?.email} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {t("submitReset")}
      </Button>
    </form>
  );
}

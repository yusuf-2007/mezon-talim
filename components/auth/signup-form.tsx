"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signUpAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "./form-bits";

const initial: AuthFormState = {};

const OCCUPATIONS = [
  "student",
  "business_owner",
  "corporate_employee",
  "educator",
  "other",
] as const;

export function SignupForm() {
  const t = useTranslations("Auth");
  const tAud = useTranslations("Audience");
  const [state, action, pending] = useActionState(signUpAction, initial);

  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <div>
        <Label htmlFor="fullName">{t("fullName")}</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required />
        <FieldError errors={state.fieldErrors?.fullName} />
      </div>
      <div>
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError errors={state.fieldErrors?.email} />
      </div>
      <div>
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
        <FieldError errors={state.fieldErrors?.password} />
      </div>
      <div>
        <Label htmlFor="occupation">{tAud("fieldLabel")}</Label>
        <select
          id="occupation"
          name="occupation"
          defaultValue=""
          className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink"
        >
          <option value="">{tAud("fieldPlaceholder")}</option>
          {OCCUPATIONS.map((o) => (
            <option key={o} value={o}>
              {tAud(`occ_${o}`)}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {t("submitSignup")}
      </Button>
    </form>
  );
}

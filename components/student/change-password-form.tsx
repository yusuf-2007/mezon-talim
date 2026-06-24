"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { changePasswordAction, type AccountFormState } from "@/lib/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChangePasswordForm() {
  const t = useTranslations("Student");
  const [state, action, pending] = useActionState(
    changePasswordAction,
    {} as AccountFormState,
  );

  return (
    <form action={action} className="max-w-md space-y-4">
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">{t("passwordChanged")}</p>}

      <div>
        <label className="mb-1 block text-sm font-medium text-navy-800">
          {t("currentPassword")}
        </label>
        <Input name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-navy-800">
          {t("newPassword")}
        </label>
        <Input name="newPassword" type="password" autoComplete="new-password" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-navy-800">
          {t("confirmPassword")}
        </label>
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </div>

      <Button type="submit" disabled={pending}>
        {t("changePassword")}
      </Button>
    </form>
  );
}

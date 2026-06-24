"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateOwnProfileAction, type AccountFormState } from "@/lib/account/actions";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ProfileEditForm({
  fullName,
  email,
  bio,
}: {
  fullName: string | null;
  email: string | null;
  bio: string | null;
}) {
  const t = useTranslations("Student");
  const [state, action, pending] = useActionState(
    updateOwnProfileAction,
    {} as AccountFormState,
  );

  return (
    <form
      action={action}
      className="max-w-lg space-y-4 rounded-xl border border-line bg-surface p-6 shadow-sm"
    >
      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div>
        <label className="mb-1 block text-sm font-medium text-navy-800">
          {t("fullNameLabel")}
        </label>
        <Input name="fullName" defaultValue={fullName ?? ""} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-navy-800">
          {t("emailLabel")}
        </label>
        <Input value={email ?? ""} disabled />
        <p className="mt-1 text-xs text-slate-500">{t("emailLocked")}</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-navy-800">
          {t("bio")}
        </label>
        <Textarea name="bio" rows={3} defaultValue={bio ?? ""} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        <Button
          render={<Link href="/dashboard/profile" />}
          variant="outline"
          type="button"
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

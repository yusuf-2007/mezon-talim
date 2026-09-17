"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateOwnProfileAction, type AccountFormState } from "@/lib/account/actions";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Name and bio only. Email, phone and password are credentials, and they now
 * live together on the settings page — editing them needs verification steps
 * that do not belong in a form whose Save button means "write these fields".
 */
export function ProfileEditForm({
  fullName,
  bio,
  bare = false,
}: {
  fullName: string | null;
  bio: string | null;
  /** Drop the card chrome when the caller already provides one. */
  bare?: boolean;
}) {
  const t = useTranslations("Student");
  const [state, action, pending] = useActionState(
    updateOwnProfileAction,
    {} as AccountFormState,
  );

  return (
    <form
      action={action}
      className={cn(
        "space-y-4",
        bare ? "max-w-xl" : "max-w-lg rounded-xl border border-line bg-surface p-6 shadow-sm",
      )}
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

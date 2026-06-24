"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  removeAvatarAction,
  uploadAvatarAction,
  type AccountFormState,
} from "@/lib/account/actions";
import { UserAvatar } from "@/components/admin/user-avatar";
import { Button } from "@/components/ui/button";

export function AvatarUploadForm({
  userId,
  name,
  email,
  hasAvatar,
}: {
  userId: string;
  name: string | null;
  email: string | null;
  hasAvatar: boolean;
}) {
  const t = useTranslations("Student");
  const [state, action, pending] = useActionState(
    uploadAvatarAction,
    {} as AccountFormState,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const currentSrc = hasAvatar ? `/api/avatars/${userId}` : null;

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar
          name={name}
          email={email}
          src={preview ?? currentSrc}
          className="size-16 text-lg"
        />
        <div className="min-w-0">
          <form action={action} className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : null);
              }}
              className="block max-w-[14rem] text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-navy-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-navy-800"
            />
            <Button type="submit" size="sm" disabled={pending}>
              {t("uploadAvatar")}
            </Button>
          </form>
          {hasAvatar && (
            <form action={removeAvatarAction} className="mt-2">
              <Button type="submit" size="sm" variant="ghost" className="text-danger">
                {t("removeAvatar")}
              </Button>
            </form>
          )}
          <p className="mt-2 text-xs text-slate-500">{t("avatarHint")}</p>
        </div>
      </div>
      {state.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}
    </div>
  );
}

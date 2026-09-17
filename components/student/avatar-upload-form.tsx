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
  bare = false,
}: {
  userId: string;
  name: string | null;
  email: string | null;
  hasAvatar: boolean;
  /** Drop the card chrome when the caller already provides one. */
  bare?: boolean;
}) {
  const t = useTranslations("Student");
  const [state, action, pending] = useActionState(
    uploadAvatarAction,
    {} as AccountFormState,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const currentSrc = hasAvatar ? `/api/avatars/${userId}` : null;

  return (
    <div className={bare ? "" : "rounded-xl border border-line bg-surface p-6 shadow-sm"}>
      <div className="flex flex-wrap items-center gap-5">
        <UserAvatar
          name={name}
          email={email}
          src={preview ?? currentSrc}
          className="size-16 text-lg"
        />
        <div className="min-w-0">
          <p className="text-[.94rem] font-semibold text-lp-ink">{t("avatarTitle")}</p>
          {/* A styled label rather than a bare file input: the native control
              renders its own "no file chosen" chrome, which cannot be themed
              and reads as an unfinished form. */}
          <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-[9px] border border-lp-line bg-surface px-3.5 py-2 text-[.84rem] font-semibold text-lp-navy transition-colors hover:bg-lp-wash">
              <input
                type="file"
                name="avatar"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setPreview(f ? URL.createObjectURL(f) : null);
                  setFileName(f?.name ?? null);
                }}
                className="sr-only"
              />
              {t("chooseImage")}
            </label>
            {fileName && (
              <span className="max-w-[12rem] truncate text-[.8rem] text-lp-muted">
                {fileName}
              </span>
            )}
            <Button type="submit" size="sm" disabled={pending || !fileName}>
              {t("uploadAvatar")}
            </Button>
            {hasAvatar && !fileName && (
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                formAction={removeAvatarAction}
                className="text-lp-danger"
              >
                {t("removeAvatar")}
              </Button>
            )}
          </form>
          <p className="mt-2 text-[.78rem] text-lp-muted">{t("avatarHintNew")}</p>
        </div>
      </div>
      {state.error && <p className="mt-3 text-sm text-lp-danger">{state.error}</p>}
    </div>
  );
}

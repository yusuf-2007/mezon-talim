"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import sharp from "sharp";
import { requireUser } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { userAvatarsRepository } from "@/lib/db/repositories/user-avatars";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { redirectLocalized } from "@/lib/i18n/redirect";

/**
 * Self-service account actions for the student dashboard. Every action is scoped
 * to the *current* user via requireUser() — a student can only edit their own
 * profile/password/prefs, and cannot change their role (role is omitted here).
 */
export type AccountFormState = { error?: string; ok?: boolean };

const profileSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(500).optional(),
  locale: z.enum(["uz", "ru"]).optional(),
});

/** Update own name / bio / locale. Redirects back to the profile on success. */
export async function updateOwnProfileAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await requireUser();
  const t = await getTranslations("Student");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t("invalidInput") };
  const d = parsed.data;

  await usersRepository.updateProfile(user.id, {
    fullName: d.fullName || null,
    bio: d.bio || null,
    locale: d.locale,
  });
  revalidatePath("/dashboard/profile");
  return redirectLocalized("/dashboard/profile");
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(1),
});

/** Change own password: verify current, then set new. */
export async function changePasswordAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await requireUser();
  const t = await getTranslations("Student");
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t("passwordTooShort") };
  const d = parsed.data;
  if (d.newPassword !== d.confirmPassword) return { error: t("passwordMismatch") };

  const dbUser = await usersRepository.findById(user.id);
  if (!dbUser?.passwordHash) return { error: t("noPassword") };
  const ok = await verifyPassword(dbUser.passwordHash, d.currentPassword);
  if (!ok) return { error: t("wrongPassword") };

  await usersRepository.setPasswordHash(user.id, await hashPassword(d.newPassword));
  return { ok: true };
}

/** Update own notification channel preferences. */
export async function updateNotificationPrefsAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  await usersRepository.updateNotificationPrefs(user.id, {
    notifyEmail: formData.get("notifyEmail") === "true",
    notifySms: formData.get("notifySms") === "true",
  });
  revalidatePath("/dashboard/settings");
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Upload + set own avatar: validate, resize to a small square webp, store in DB. */
export async function uploadAvatarAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await requireUser();
  const t = await getTranslations("Student");
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: t("avatarMissing") };
  }
  if (!AVATAR_TYPES.includes(file.type)) return { error: t("avatarBadType") };
  if (file.size > MAX_AVATAR_BYTES) return { error: t("avatarTooBig") };

  try {
    const input = Buffer.from(await file.arrayBuffer());
    const webp = await sharp(input)
      .resize(128, 128, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
    await userAvatarsRepository.upsert(user.id, webp.toString("base64"), "image/webp");
  } catch {
    return { error: t("avatarFailed") };
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return redirectLocalized("/dashboard/profile");
}

/** Remove own avatar. */
export async function removeAvatarAction(): Promise<void> {
  const user = await requireUser();
  await userAvatarsRepository.remove(user.id);
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
}

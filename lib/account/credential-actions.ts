"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { refreshSession, requireUser } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { isUniqueViolation } from "@/lib/db/errors";
import { emailVerificationsRepository } from "@/lib/db/repositories/email-verifications";
import { requestEmailVerification } from "@/lib/auth/email-verify";
import { requestPhoneOtp, verifyPhoneOtp } from "@/lib/auth/otp";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { addEmailSchema, passwordSchema, verifyOtpSchema } from "@/lib/auth/schemas";
import { requestOtpSchema } from "@/lib/auth/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

/**
 * Self-service credential management.
 *
 * An account can be created with a phone or with an email + password, and this
 * is where it grows the other one. Every action is scoped to the signed-in user
 * — the session is the authorisation, which is also why setting a first
 * password here needs no existing password to prove.
 */
export type CredentialFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  ok?: boolean;
  message?: string;
  /** Phone flow: "code" once an SMS is out. */
  step?: "code";
  phone?: string;
};

const MIN = 60_000;

function fieldErrors(error: z.ZodError): CredentialFormState {
  return {
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

function revalidateAccount(): void {
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/settings");
}

// ── Email ───────────────────────────────────────────────────────────────────

/**
 * Claim an email address. The address is NOT written to the account here: it is
 * only stored as a pending claim until the link is followed, so an unverified
 * address can never occupy the unique `users.email` slot and lock out its real
 * owner.
 */
export async function addEmailAction(
  _prev: CredentialFormState,
  formData: FormData,
): Promise<CredentialFormState> {
  const user = await requireUser();
  const t = await getTranslations("Account");

  const parsed = addEmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fieldErrors(parsed.error);

  const limited = await checkRateLimit(`email:claim:${user.id}`, 5, 60 * MIN);
  if (!limited.ok) return { error: t("tooManyAttempts") };

  const result = await requestEmailVerification(user.id, parsed.data.email);
  if (result === "taken") return { fieldErrors: { email: [t("emailTaken")] } };
  if (result === "already-yours") return { error: t("emailAlreadyYours") };

  revalidateAccount();
  return { ok: true, message: t("emailClaimSent", { email: parsed.data.email }) };
}

/** Re-send the link for the claim already on file. */
export async function resendEmailVerificationAction(): Promise<void> {
  const user = await requireUser();
  const pending = await emailVerificationsRepository.findActiveForUser(user.id);
  const target = pending?.email ?? user.email;
  if (!target) return;

  const limited = await checkRateLimit(`email:resend:${user.id}`, 5, 60 * MIN);
  if (!limited.ok) return;

  await requestEmailVerification(user.id, target);
  revalidateAccount();
}

// ── Phone ───────────────────────────────────────────────────────────────────

/** Step 1 of adding or changing a phone: send a code to the new number. */
export async function sendPhoneChangeCodeAction(
  _prev: CredentialFormState,
  formData: FormData,
): Promise<CredentialFormState> {
  const user = await requireUser();
  const t = await getTranslations("Account");
  if (!env.OTP_LOGIN_ENABLED) return { error: t("phoneUnavailable") };

  const parsed = requestOtpSchema.safeParse({ phone: formData.get("phone") });
  if (!parsed.success) return fieldErrors(parsed.error);
  const { phone } = parsed.data;

  if (user.phone === phone) return { error: t("phoneAlreadyYours") };

  // Someone else's number is rejected before an SMS goes out — otherwise this
  // becomes a way to send texts to arbitrary numbers on our balance, and the
  // student would only learn it was futile after entering the code.
  const owner = await usersRepository.findByPhone(phone);
  if (owner && owner.id !== user.id) {
    return { fieldErrors: { phone: [t("phoneTaken")] } };
  }

  const limited = await checkRateLimit(`phone:claim:${user.id}`, 5, 60 * MIN);
  if (!limited.ok) return { error: t("tooManyAttempts") };

  try {
    await requestPhoneOtp(phone);
  } catch (err) {
    console.error("phone change OTP failed:", err);
    return { error: t("phoneSendFailed") };
  }
  return { ok: true, step: "code", phone, message: t("phoneCodeSent") };
}

/** Step 2: check the code, then attach the number to this account. */
export async function confirmPhoneChangeAction(
  _prev: CredentialFormState,
  formData: FormData,
): Promise<CredentialFormState> {
  const user = await requireUser();
  const t = await getTranslations("Account");
  if (!env.OTP_LOGIN_ENABLED) return { error: t("phoneUnavailable") };

  const parsed = verifyOtpSchema.safeParse({
    phone: formData.get("phone"),
    code: formData.get("code"),
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const { phone, code } = parsed.data;

  const limited = await checkRateLimit(`phone:confirm:${user.id}`, 15, 15 * MIN);
  if (!limited.ok) return { error: t("tooManyAttempts") };

  const ok = await verifyPhoneOtp(phone, code);
  if (!ok) return { error: t("codeInvalid"), step: "code", phone };

  try {
    await usersRepository.attachPhone(user.id, phone);
  } catch (err) {
    // Claimed by someone else between the pre-check and now.
    if (!isUniqueViolation(err)) throw err;
    return { fieldErrors: { phone: [t("phoneTaken")] } };
  }

  await refreshSession();
  revalidateAccount();
  return { ok: true, message: t("phoneSaved") };
}

// ── Password ────────────────────────────────────────────────────────────────

const setPasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Parollar mos kelmadi",
  });

/**
 * Set a first password, or change an existing one.
 *
 * A phone-first account has no password at all, so the old change-password form
 * — which always demanded the current one — was unusable for exactly the
 * students the phone path creates. When there is no password on file the
 * session itself is the proof of identity; when there is one, it must still be
 * given, so a borrowed unlocked browser cannot lock the owner out.
 */
export async function setPasswordAction(
  _prev: CredentialFormState,
  formData: FormData,
): Promise<CredentialFormState> {
  const sessionUser = await requireUser();
  const t = await getTranslations("Account");

  const parsed = setPasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? undefined,
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return fieldErrors(parsed.error);

  const user = await usersRepository.findById(sessionUser.id);
  if (!user) return { error: t("somethingWrong") };

  if (user.passwordHash) {
    const current = parsed.data.currentPassword ?? "";
    if (!current) return { fieldErrors: { currentPassword: [t("currentRequired")] } };
    const matches = await verifyPassword(user.passwordHash, current);
    if (!matches) return { fieldErrors: { currentPassword: [t("wrongPassword")] } };
  }

  await usersRepository.setPasswordHash(
    user.id,
    await hashPassword(parsed.data.newPassword),
  );
  revalidateAccount();
  return { ok: true, message: user.passwordHash ? t("passwordChanged") : t("passwordSet") };
}

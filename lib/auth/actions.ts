"use server";

import { AuthError } from "next-auth";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { usersRepository } from "@/lib/db/repositories/users";
import { env } from "@/lib/env";
import { signIn, signOut } from "./config";
import { hashPassword } from "./password";
import { requestPhoneOtp } from "./otp";
import { requestPasswordReset, resetPassword } from "./reset";
import { landingPathForRole } from "./landing";
import {
  loginSchema,
  requestOtpSchema,
  requestResetSchema,
  signUpSchema,
  verifyOtpSchema,
} from "./schemas";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  ok?: boolean;
  message?: string;
};

function fieldErrors(error: z.ZodError): AuthFormState {
  return { fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}

// ── Email + password ────────────────────────────────────────────────────────

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getTranslations("Auth");
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fieldErrors(parsed.error);

  const existing = await usersRepository.findByEmail(parsed.data.email);
  if (existing) return { fieldErrors: { email: [t("emailTaken")] } };

  await usersRepository.createWithPassword({
    email: parsed.data.email,
    fullName: parsed.data.fullName,
    passwordHash: await hashPassword(parsed.data.password),
    role: "student",
  });

  try {
    await signIn("password", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: t("somethingWrong") };
    throw e;
  }
  return redirectLocalized("/dashboard");
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getTranslations("Auth");
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fieldErrors(parsed.error);

  try {
    await signIn("password", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: t("invalidCredentials") };
    throw e;
  }

  const user = await usersRepository.findByEmail(parsed.data.email);
  return redirectLocalized(landingPathForRole(user?.role ?? "student"));
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
  return redirectLocalized("/");
}

// ── Password reset (dev: link logged; Resend in Phase 8) ─────────────────────

export async function requestResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getTranslations("Auth");
  const parsed = requestResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fieldErrors(parsed.error);

  await requestPasswordReset(parsed.data.email);
  // Always the same response — no account enumeration.
  return { ok: true, message: t("resetSent") };
}

const resetPasswordFormSchema = z.object({
  email: z.email(),
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak"),
});

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getTranslations("Auth");
  const parsed = resetPasswordFormSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fieldErrors(parsed.error);

  const result = await resetPassword(
    parsed.data.email,
    parsed.data.token,
    parsed.data.password,
  );
  if (result === "invalid") return { error: t("resetInvalid") };
  if (result === "expired") return { error: t("resetExpired") };

  return redirectLocalized("/login");
}

// ── Phone OTP (gated by OTP_LOGIN_ENABLED) ───────────────────────────────────

export async function requestOtpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getTranslations("Auth");
  if (!env.OTP_LOGIN_ENABLED) return { error: t("otpDisabled") };

  const parsed = requestOtpSchema.safeParse({ phone: formData.get("phone") });
  if (!parsed.success) return fieldErrors(parsed.error);

  await requestPhoneOtp(parsed.data.phone);
  return { ok: true, message: t("otpSent") };
}

export async function verifyOtpLoginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getTranslations("Auth");
  if (!env.OTP_LOGIN_ENABLED) return { error: t("otpDisabled") };

  const parsed = verifyOtpSchema.safeParse({
    phone: formData.get("phone"),
    code: formData.get("code"),
  });
  if (!parsed.success) return fieldErrors(parsed.error);

  try {
    await signIn("phone-otp", {
      phone: parsed.data.phone,
      code: parsed.data.code,
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: t("otpInvalid") };
    throw e;
  }

  const user = await usersRepository.findByPhone(parsed.data.phone);
  return redirectLocalized(landingPathForRole(user?.role ?? "student"));
}

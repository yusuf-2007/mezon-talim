"use server";

import { AuthError } from "next-auth";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { usersRepository } from "@/lib/db/repositories/users";
import { isUniqueViolation } from "@/lib/db/errors";
import { notifyWelcome } from "@/lib/notifications/service";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestIp } from "@/lib/request-ip";
import { env } from "@/lib/env";
import { signIn, signOut } from "./config";
import { hashPassword } from "./password";
import { requestPhoneOtp, verifyPhoneOtp } from "./otp";
import { requestEmailVerification } from "./email-verify";
import { requestPasswordReset, resetPassword } from "./reset";
import {
  clearPhoneTicket,
  issuePhoneTicket,
  readPhoneTicketToken,
} from "./phone-ticket";
import { landingPathForRole } from "./landing";
import { getCurrentUser } from "./index";
import {
  completePhoneSignupSchema,
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
  /**
   * Where the phone flow goes next. "code" = we sent an SMS; "profile" = the
   * code was accepted but this number has no account yet, so the sign-up
   * fields come next. The server decides this, never the browser.
   */
  step?: "code" | "profile";
  /** The number as normalised server-side, so the UI echoes what we verified. */
  phone?: string;
};

const MIN = 60_000;

function fieldErrors(error: z.ZodError): AuthFormState {
  return { fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}

// ── Phone (primary path) ────────────────────────────────────────────────────

/**
 * Step 1: send a login/sign-up code.
 *
 * Rate-limited on two keys. Per-number blunts someone hammering one victim's
 * phone; per-IP is the one that matters commercially, because every send costs
 * real money on a prepaid Eskiz balance and nothing else stops a script from
 * walking the +998 range. The 60-second per-number cooldown inside
 * requestPhoneOtp is a UX guard, not a budget guard — it would let a single
 * source spend the balance on 10 000 different numbers.
 */
export async function sendPhoneCodeAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getTranslations("Auth");
  if (!env.OTP_LOGIN_ENABLED) return { error: t("otpDisabled") };

  const parsed = requestOtpSchema.safeParse({ phone: formData.get("phone") });
  if (!parsed.success) return fieldErrors(parsed.error);
  const { phone } = parsed.data;

  const [byPhone, byIp] = await Promise.all([
    checkRateLimit(`otp:send:${phone}`, 5, 15 * MIN),
    checkRateLimit(`otp:send:ip:${await requestIp()}`, 20, 60 * MIN),
  ]);
  if (!byPhone.ok || !byIp.ok) return { error: t("tooManyAttempts") };

  try {
    await requestPhoneOtp(phone);
  } catch (err) {
    // Eskiz being down, out of balance, or rejecting an unapproved template
    // must not surface as a server error — the student just retries.
    console.error("phone OTP send failed:", err);
    return { error: t("otpSendFailed") };
  }
  return { ok: true, step: "code", phone, message: t("otpSent") };
}

/**
 * Step 2: check the code.
 *
 * On success the number is banked as a signed ticket (see ./phone-ticket) and
 * the two outcomes diverge: a known number signs in immediately, an unknown one
 * is sent to the sign-up fields. The account-exists lookup happens only after a
 * correct code, so this endpoint cannot be used to test whether a number is
 * registered.
 */
export async function verifyPhoneCodeAction(
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
  const { phone, code } = parsed.data;

  const limited = await checkRateLimit(`otp:verify:${phone}`, 15, 15 * MIN);
  if (!limited.ok) return { error: t("tooManyAttempts") };

  const verified = await verifyPhoneOtp(phone, code);
  if (!verified) return { error: t("otpInvalid"), step: "code", phone };

  await issuePhoneTicket(phone);

  const existing = await usersRepository.findByPhone(phone);
  if (!existing) {
    // New number: collect a name before the account exists at all.
    return { ok: true, step: "profile", phone };
  }
  if (!existing.isActive) return { error: t("accountDisabled") };

  await signInWithTicket(t);
  return redirectLocalized(landingPathForRole(existing.role));
}

/** Step 3 (new numbers only): name + occupation, then create and sign in. */
export async function completePhoneSignupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getTranslations("Auth");
  if (!env.OTP_LOGIN_ENABLED) return { error: t("otpDisabled") };

  const parsed = completePhoneSignupSchema.safeParse({
    fullName: formData.get("fullName"),
    occupation: formData.get("occupation") ?? undefined,
  });
  if (!parsed.success) return fieldErrors(parsed.error);

  const created = await signInWithTicket(t, {
    fullName: parsed.data.fullName,
    occupation: parsed.data.occupation ?? "",
  });
  if (created) return created; // an error state

  // Best-effort welcome; a phone-only account has no address yet, so this is a
  // no-op until they add one — see dispatchEmail.
  const user = await getCurrentUser();
  if (user) await notifyWelcome(user.id);

  return redirectLocalized("/dashboard");
}

/**
 * Hand the banked ticket to Auth.js. Returns an error state on failure, or
 * undefined once the session cookie is set.
 */
async function signInWithTicket(
  t: Awaited<ReturnType<typeof getTranslations<"Auth">>>,
  profile?: { fullName: string; occupation: string },
): Promise<AuthFormState | undefined> {
  const ticket = await readPhoneTicketToken();
  if (!ticket) return { error: t("otpExpired") };

  try {
    await signIn("phone-ticket", {
      ticket,
      fullName: profile?.fullName ?? "",
      occupation: profile?.occupation ?? "",
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: t("otpExpired") };
    throw e;
  }
  // Single-use: the ticket has done its job, and leaving it in the browser
  // would be a second way to sign in as this number for the next ten minutes.
  await clearPhoneTicket();
  return undefined;
}

// ── Email + password (secondary path) ───────────────────────────────────────

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getTranslations("Auth");
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    occupation: formData.get("occupation") ?? undefined,
  });
  if (!parsed.success) return fieldErrors(parsed.error);

  const limited = await checkRateLimit(`signup:ip:${await requestIp()}`, 10, 60 * MIN);
  if (!limited.ok) return { error: t("tooManyAttempts") };

  const existing = await usersRepository.findByEmail(parsed.data.email);
  if (existing) return { fieldErrors: { email: [t("emailTaken")] } };

  let created;
  try {
    created = await usersRepository.createWithPassword({
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      passwordHash: await hashPassword(parsed.data.password),
      role: "student",
      occupation: parsed.data.occupation ?? null,
    });
  } catch (err) {
    // The check above cannot close the gap between reading and inserting; the
    // unique index does. Either way the student sees the same field error.
    if (!isUniqueViolation(err)) throw err;
    return { fieldErrors: { email: [t("emailTaken")] } };
  }

  // Both best-effort; neither may block a successful signup.
  await notifyWelcome(created.id);
  await requestEmailVerification(created.id, parsed.data.email).catch((err) => {
    console.error("signup verification email failed:", err);
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
  return redirectLocalized(landingPathForRole(created.role));
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

  // Per-address stops one account being ground down; per-IP stops one source
  // spraying a list of addresses with common passwords. Neither existed before.
  const [byEmail, byIp] = await Promise.all([
    checkRateLimit(`login:${parsed.data.email}`, 10, 15 * MIN),
    checkRateLimit(`login:ip:${await requestIp()}`, 50, 15 * MIN),
  ]);
  if (!byEmail.ok || !byIp.ok) return { error: t("tooManyAttempts") };

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

// ── Password reset ──────────────────────────────────────────────────────────

export async function requestResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getTranslations("Auth");
  const parsed = requestResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fieldErrors(parsed.error);

  const [byEmail, byIp] = await Promise.all([
    checkRateLimit(`reset:${parsed.data.email}`, 5, 60 * MIN),
    checkRateLimit(`reset:ip:${await requestIp()}`, 20, 60 * MIN),
  ]);
  // Still the same reply when throttled — a different one would turn this into
  // an oracle for which addresses have accounts.
  if (byEmail.ok && byIp.ok) {
    await requestPasswordReset(parsed.data.email);
  }
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

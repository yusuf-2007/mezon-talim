import { z } from "zod";

/**
 * Shared auth input schemas. Validated at every server boundary (authorize
 * callbacks + server actions) — CLAUDE.md §8.
 */

/**
 * Normalise whatever shape a phone number arrives in to E.164.
 *
 * Uzbek numbers are written half a dozen ways in the wild — "90 123 45 67",
 * "(90) 123-45-67", "998901234567", "+998 90 123 45 67" — and phone is now the
 * primary login credential, so a rejected paste is a locked-out student. It is
 * also the account's unique key: accepting two spellings of one number as two
 * accounts would be worse than rejecting either, which is why normalisation
 * happens here, in the shared schema, rather than in one form's onChange.
 */
function normalizePhone(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const digits = value.replace(/\D/g, "");
  if (!digits) return value.trim();
  // Local 9-digit form (90 123 45 67) — the way numbers are spoken in UZ.
  if (digits.length === 9) return `+998${digits}`;
  // With country code, with or without a leading + or 00.
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  if (digits.length === 14 && digits.startsWith("00998")) return `+${digits.slice(2)}`;
  // Anything else falls through to the regex below and is reported as invalid.
  return value.trim();
}

// Uzbek E.164 mobile, e.g. +998901234567 (launch market is UZ).
export const phoneSchema = z.preprocess(
  normalizePhone,
  z
    .string()
    .trim()
    .regex(/^\+998\d{9}$/, "Telefon raqamini to'liq kiriting, masalan +998901234567"),
);

export const emailSchema = z.email().trim().toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak")
  .max(200);

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Ismingizni kiriting")
  .max(120);

export const occupationSchema = z
  .enum(["student", "business_owner", "corporate_employee", "educator", "other"])
  .optional()
  .or(z.literal("").transform(() => undefined));

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  occupation: occupationSchema,
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const requestResetSchema = z.object({ email: emailSchema });

export const requestOtpSchema = z.object({ phone: phoneSchema });

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().regex(/^\d{4}$/, "Kod 4 ta raqamdan iborat"),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/** Second half of phone sign-up: the profile fields, once the code is accepted. */
export const completePhoneSignupSchema = z.object({
  fullName: fullNameSchema,
  occupation: occupationSchema,
});
export type CompletePhoneSignupInput = z.infer<typeof completePhoneSignupSchema>;

/** Claiming an email address from the profile page. */
export const addEmailSchema = z.object({ email: emailSchema });

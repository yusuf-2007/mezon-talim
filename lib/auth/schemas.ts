import { z } from "zod";

/**
 * Shared auth input schemas. Validated at every server boundary (authorize
 * callbacks + server actions) — CLAUDE.md §8.
 */

// Uzbek E.164 mobile, e.g. +998901234567 (launch market is UZ).
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+998\d{9}$/, "Telefon raqami +998 bilan boshlanishi kerak");

export const emailSchema = z.email().trim().toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak")
  .max(200);

export const occupationSchema = z
  .enum(["student", "business_owner", "corporate_employee", "educator", "other"])
  .optional()
  .or(z.literal("").transform(() => undefined));

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
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
  code: z.string().trim().regex(/^\d{6}$/, "Kod 6 ta raqamdan iborat"),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

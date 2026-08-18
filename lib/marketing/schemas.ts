import { z } from "zod";
import { phoneSchema } from "@/lib/auth/schemas";

/**
 * Landing-page lead form. Validated server-side at the action boundary
 * (CLAUDE.md §8) — the client form only mirrors these rules for fast feedback.
 */
export const applicationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  organization: z
    .string()
    .trim()
    .max(160)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  source: z
    .enum(["landing_cpss", "landing_bim", "landing_b2b", "other"])
    .default("landing_cpss"),
  /**
   * Explicit opt-in to SMS. Required to be recorded before we may send one —
   * Eskiz contract 1830-2026 §4.1.8 (consent must be obtained *and* registered)
   * and §5.5 (30 BRV fine for sending without it). Unticked is allowed; it just
   * means we may only call.
   */
  smsConsent: z.coerce.boolean().default(false),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

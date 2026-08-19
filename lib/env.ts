import { z } from "zod";

/**
 * Server-side environment validation. Import this ONLY from server code
 * (repositories, route handlers, server actions) — never from client components.
 *
 * Phase 1: only DATABASE_URL is strictly required (the DB client uses it).
 * Provider secrets (Bunny, Click, Payme, Resend, Eskiz, MinIO) are optional
 * here and become required as each integration lands in its phase.
 */
/**
 * Boolean env flag.
 *
 * Values arrive as raw strings from wherever the process was launched, and
 * hosting dashboards are a common source of near-misses: a value pasted from a
 * `.env` snippet keeps its quotes, and copied text keeps trailing whitespace.
 * Both used to fail the enum and crash the build with a message that named the
 * variable but not the actual mistake. Normalise first, then validate — a
 * genuinely wrong value ("yes", "1") still fails loudly.
 */
function boolFlag(fallback: "true" | "false") {
  return z
    .preprocess(
      (v) => {
        if (typeof v !== "string") return v;
        const cleaned = v.trim().replace(/^["']|["']$/g, "").trim().toLowerCase();
        // Treat a blank value as "not set" so the default applies, matching how
        // an empty optional string is handled elsewhere in this schema.
        return cleaned === "" ? undefined : cleaned;
      },
      z.enum(["true", "false"]).default(fallback),
    )
    .transform((v) => v === "true");
}

const envSchema = z.object({
  // --- Core ---
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.url().optional(),

  // --- Storage (MinIO, in-country) ---
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.coerce.number().optional(),
  MINIO_USE_SSL: boolFlag("false"),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().optional(),

  // --- Video (Bunny.net Stream — external, non-personal) ---
  BUNNY_STREAM_LIBRARY_ID: z.string().optional(),
  BUNNY_STREAM_API_KEY: z.string().optional(),
  BUNNY_STREAM_CDN_HOSTNAME: z.string().optional(),
  BUNNY_TOKEN_AUTH_KEY: z.string().optional(),

  // --- Error monitoring (Sentry — optional; SDK is a no-op without it) ---
  SENTRY_DSN: z.string().optional(),

  // --- Cron auth (Vercel sends `Authorization: Bearer <CRON_SECRET>`) ---
  CRON_SECRET: z.string().optional(),

  // --- Payments (Click + Payme) ---
  CLICK_SERVICE_ID: z.string().optional(),
  CLICK_MERCHANT_ID: z.string().optional(),
  CLICK_SECRET_KEY: z.string().optional(),
  PAYME_MERCHANT_ID: z.string().optional(),
  PAYME_KEY: z.string().optional(),

  // --- Email (Resend — external, non-personal delivery) ---
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),

  // --- SMS (Eskiz — in-country) ---
  ESKIZ_EMAIL: z.string().optional(),
  ESKIZ_PASSWORD: z.string().optional(),
  ESKIZ_FROM: z.string().optional(),

  // --- Feature flags ---
  // Phone-OTP login. Keep OFF until Eskiz onboarding (sender name + approved
  // OTP template) is complete; email+password works without it. See the
  // phase2-auth-sequencing decision.
  OTP_LOGIN_ENABLED: boolFlag("false"),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    z.flattenError(parsed.error).fieldErrors,
  );
  throw new Error("Invalid environment variables — see .env.example");
}

export const env: Env = parsed.data;

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

/**
 * Optional text from the environment, normalised before validation.
 *
 * Hosting dashboards are a reliable source of near-misses: a value pasted from
 * a `.env` snippet keeps its quotes, copied text keeps its whitespace, and a
 * field someone meant to clear is left as an empty string rather than deleted.
 * All three used to survive into the app as real values — an `AUTH_URL` of ""
 * failed `z.url()` and took the whole boot down, and a quoted `ESKIZ_FROM`
 * would be forwarded to the SMS gateway verbatim as the sender name.
 *
 * Blank means "not set", which is what the person clearing the field meant.
 */
function optionalText() {
  return z.preprocess(blankToUndefined, z.string().optional());
}

/** As optionalText, but the value must parse as a URL when present. */
function optionalUrl() {
  return z.preprocess(blankToUndefined, z.url().optional());
}

function blankToUndefined(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const cleaned = v.trim().replace(/^["']|["']$/g, "").trim();
  return cleaned === "" ? undefined : cleaned;
}

const envSchema = z.object({
  // --- Core ---
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_URL: optionalUrl(),

  // --- Storage (MinIO, in-country) ---
  MINIO_ENDPOINT: optionalText(),
  MINIO_PORT: z.coerce.number().optional(),
  MINIO_USE_SSL: boolFlag("false"),
  MINIO_ACCESS_KEY: optionalText(),
  MINIO_SECRET_KEY: optionalText(),
  MINIO_BUCKET: optionalText(),

  // --- Video (Bunny.net Stream — external, non-personal) ---
  BUNNY_STREAM_LIBRARY_ID: optionalText(),
  BUNNY_STREAM_API_KEY: optionalText(),
  BUNNY_STREAM_CDN_HOSTNAME: optionalText(),
  BUNNY_TOKEN_AUTH_KEY: optionalText(),

  // --- Deployment (injected by Vercel; see lib/base-url.ts) ---
  VERCEL_PROJECT_PRODUCTION_URL: optionalText(),

  // --- Error monitoring (Sentry — optional; SDK is a no-op without it) ---
  SENTRY_DSN: optionalText(),

  // --- Cron auth (Vercel sends `Authorization: Bearer <CRON_SECRET>`) ---
  CRON_SECRET: optionalText(),

  // --- Payments (Click + Payme) ---
  CLICK_SERVICE_ID: optionalText(),
  CLICK_MERCHANT_ID: optionalText(),
  CLICK_SECRET_KEY: optionalText(),
  PAYME_MERCHANT_ID: optionalText(),
  PAYME_KEY: optionalText(),

  // --- Email (Resend — external, non-personal delivery) ---
  RESEND_API_KEY: optionalText(),
  RESEND_FROM_EMAIL: optionalText(),
  // Svix signing secret for /api/webhooks/resend. Without it the endpoint
  // refuses every request rather than trusting unsigned delivery events.
  RESEND_WEBHOOK_SECRET: optionalText(),

  // --- SMS (Eskiz — in-country) ---
  ESKIZ_EMAIL: optionalText(),
  ESKIZ_PASSWORD: optionalText(),
  ESKIZ_FROM: optionalText(),

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

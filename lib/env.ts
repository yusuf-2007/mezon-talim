import { z } from "zod";

/**
 * Server-side environment validation. Import this ONLY from server code
 * (repositories, route handlers, server actions) — never from client components.
 *
 * Phase 1: only DATABASE_URL is strictly required (the DB client uses it).
 * Provider secrets (Bunny, Click, Payme, Resend, Eskiz, MinIO) are optional
 * here and become required as each integration lands in its phase.
 */
const envSchema = z.object({
  // --- Core ---
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.url().optional(),

  // --- Storage (MinIO, in-country) ---
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.coerce.number().optional(),
  MINIO_USE_SSL: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().optional(),

  // --- Video (Bunny.net Stream — external, non-personal) ---
  BUNNY_STREAM_LIBRARY_ID: z.string().optional(),
  BUNNY_STREAM_API_KEY: z.string().optional(),
  BUNNY_STREAM_CDN_HOSTNAME: z.string().optional(),
  BUNNY_TOKEN_AUTH_KEY: z.string().optional(),

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

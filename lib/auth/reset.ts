import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { usersRepository } from "@/lib/db/repositories/users";
import { verificationTokensRepository } from "@/lib/db/repositories/verification-tokens";
import { hashPassword } from "./password";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

// Tokens are stored hashed; only the raw token travels in the email link.
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Begin a password reset. Always resolves the same way (no account enumeration).
 * Sends a reset link via email — Resend lands in Phase 8, so for now the link is
 * logged to the server console in dev.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await usersRepository.findByEmail(email);
  if (!user) return; // silent — don't reveal whether the email exists

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + RESET_TTL_MS);
  await verificationTokensRepository.create(email, sha256(token), expires);

  const base = env.AUTH_URL ?? "http://localhost:3000";
  const link = `${base}/reset/${token}?email=${encodeURIComponent(email)}`;

  // TODO(phase-8): deliver via Resend (getEmailSender()).
  console.info(`[dev password reset → ${email}] ${link}`);
}

export type ResetResult = "ok" | "invalid" | "expired";

export async function resetPassword(
  email: string,
  token: string,
  newPassword: string,
): Promise<ResetResult> {
  const tokenHash = sha256(token);
  const record = await verificationTokensRepository.find(email, tokenHash);
  if (!record) return "invalid";

  if (record.expires.getTime() < Date.now()) {
    await verificationTokensRepository.delete(email, tokenHash);
    return "expired";
  }

  const user = await usersRepository.findByEmail(email);
  if (!user) return "invalid";

  await usersRepository.setPasswordHash(user.id, await hashPassword(newPassword));
  await verificationTokensRepository.delete(email, tokenHash);
  return "ok";
}

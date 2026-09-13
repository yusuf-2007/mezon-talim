import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { publicBaseUrl } from "@/lib/base-url";
import { usersRepository } from "@/lib/db/repositories/users";
import { emailVerificationsRepository } from "@/lib/db/repositories/email-verifications";
import { isUniqueViolation } from "@/lib/db/errors";
import { dispatchEmail } from "@/lib/notifications/service";
import { emailVerificationEmail } from "@/lib/notifications/templates";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Email-address ownership proof.
 *
 * An address only reaches `users.email` once its link is clicked, so an
 * unverified claim can never squat on someone else's address, and the "✓
 * verified" badge on the profile is true by construction rather than by a
 * separate flag someone has to remember to set.
 */

export const EMAIL_VERIFY_TTL_HOURS = 24;
const TTL_MS = EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000;

// Tokens are stored hashed; only the raw token travels in the link.
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function baseUrl(): string {
  return publicBaseUrl();
}

export type RequestEmailResult = "sent" | "taken" | "already-yours";

/**
 * Issue a fresh claim on `email` for `userId` and send the link.
 *
 * Two different situations arrive here and both must send:
 *  - the profile "add email" flow, where the address is not on any account yet;
 *  - email sign-up, where the address is already this account's login (it has
 *    to be, or the new account could not sign in) but is not yet proven.
 * Only an address that is already *confirmed* on this account has nothing left
 * to do; an address on someone else's account is refused.
 *
 * The taken-check here is a courtesy, not the guarantee — the real one is the
 * unique index, enforced at confirm time (see confirmEmailVerification).
 */
export async function requestEmailVerification(
  userId: string,
  email: string,
): Promise<RequestEmailResult> {
  const user = await usersRepository.findById(userId);
  if (!user) return "taken";

  const isOwnAddress = user.email?.toLowerCase() === email.toLowerCase();
  if (isOwnAddress && user.emailVerified) return "already-yours";

  if (!isOwnAddress) {
    const owner = await usersRepository.findByEmail(email);
    if (owner) return "taken";
  }

  // Retire any earlier claim first, so an address the student typed by mistake
  // cannot still be confirmed later from a link sitting in someone's inbox.
  await emailVerificationsRepository.consumeAllForUser(userId);

  const token = randomBytes(32).toString("hex");
  await emailVerificationsRepository.create(
    userId,
    email,
    sha256(token),
    new Date(Date.now() + TTL_MS),
  );

  const locale = (user.locale ?? "uz") as Locale;
  await dispatchEmail(
    userId,
    "email_verification",
    email,
    emailVerificationEmail(locale, {
      name: user.fullName || user.name || email,
      // The link targets the API route, not the page: confirming writes to the
      // user row and refreshes the session cookie, and only a route handler
      // may do the latter.
      verifyUrl: `${baseUrl()}/api/verify-email/${token}?locale=${locale}`,
      hours: EMAIL_VERIFY_TTL_HOURS,
    }),
  );
  return "sent";
}

export type ConfirmEmailResult = "ok" | "invalid" | "taken";

/**
 * Complete a claim. Invalid, expired and already-used tokens are deliberately
 * indistinguishable to the caller: the page shows one "this link no longer
 * works" state, and there is nothing a visitor can do differently per case.
 */
export async function confirmEmailVerification(
  token: string,
): Promise<ConfirmEmailResult> {
  const tokenHash = sha256(token);
  const record = await emailVerificationsRepository.findActiveByToken(tokenHash);
  if (!record) return resolveSpentToken(tokenHash);

  try {
    await usersRepository.setVerifiedEmail(record.userId, record.email);
  } catch (err) {
    // Someone else confirmed this address first. Burn the losing claim so the
    // student is not invited to keep retrying a link that can never succeed.
    if (!isUniqueViolation(err)) throw err;
    await emailVerificationsRepository.markConsumed(record.id);
    return "taken";
  }

  await emailVerificationsRepository.consumeAllForUser(record.userId);
  return "ok";
}

/**
 * What a token that is no longer active actually means.
 *
 * Corporate mail scanners follow links before a person ever sees them, and a
 * double-click does the same thing, so "already used" is a routine outcome
 * rather than an error. If the address on the spent claim is the one now on the
 * account, the link did its job — saying otherwise would send someone to
 * request a replacement for something already finished.
 */
async function resolveSpentToken(tokenHash: string): Promise<ConfirmEmailResult> {
  const record = await emailVerificationsRepository.findByToken(tokenHash);
  if (!record) return "invalid";

  const user = await usersRepository.findById(record.userId);
  const settled =
    user?.email?.toLowerCase() === record.email.toLowerCase() && user?.emailVerified;
  return settled ? "ok" : "invalid";
}

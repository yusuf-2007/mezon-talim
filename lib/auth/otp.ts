import "server-only";
import { randomInt } from "node:crypto";
import { hashPassword, verifyPassword } from "./password";
import { phoneOtpsRepository } from "@/lib/db/repositories/phone-otps";
import { sendTrackedSms } from "@/lib/notifications/service";
import { usersRepository } from "@/lib/db/repositories/users";
import { otpSms } from "@/lib/notifications/templates";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends

/** Digits in a code. 4 is the norm in UZ; see MAX_OTP_ATTEMPTS for the cost. */
const OTP_DIGITS = 4;

/**
 * Wrong guesses before the code is burned.
 *
 * A 4-digit code is only 10 000 combinations, so an uncapped verify endpoint is
 * exhaustible well inside the 5-minute window — that is account takeover from
 * nothing but a phone number. Capping at 5 puts a single code's odds at
 * 5/10 000, and the resend cooldown bounds how fast fresh codes can be minted.
 *
 * Deliberately NOT built on `checkRateLimit`: that limiter is fail-open by
 * design, and a limiter that opens under database trouble is no defence here.
 * A failure in this path throws and the login simply does not succeed.
 */
const MAX_OTP_ATTEMPTS = 5;

/**
 * Phone OTP issuance + verification (Eskiz-backed; dev-console fallback).
 * Codes are 4 digits, stored hashed (argon2), single-use, time-boxed, and
 * burned after MAX_OTP_ATTEMPTS wrong guesses.
 * This is the engine behind the gated phone-login flow.
 */
export async function requestPhoneOtp(phone: string): Promise<void> {
  const active = await phoneOtpsRepository.findActive(phone);
  if (active && Date.now() - active.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    // Don't reissue too frequently; the existing code is still valid.
    return;
  }

  // Attribution only — a sign-up code goes to a number with no account yet,
  // and that is not a reason to leave the send unlogged.
  const user = await usersRepository.findByPhone(phone);

  const code = String(randomInt(0, 10 ** OTP_DIGITS)).padStart(OTP_DIGITS, "0");
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const row = await phoneOtpsRepository.create(phone, codeHash, expiresAt);

  try {
    // Body lives with the other Eskiz-moderated templates; it must match the
    // approved text exactly or the operator silently drops it.
    //
    // Routed through the notification log rather than the sender directly, so a
    // code that the operator drops after accepting is visible afterwards. This
    // is the send where that matters most: a student who never receives one
    // cannot get in at all, and has no way to tell us anything except "it
    // doesn't work".
    await sendTrackedSms({
      userId: user?.id ?? null,
      type: "login_otp",
      to: phone,
      text: otpSms(code),
    });
  } catch (err) {
    // The row is written before the send, so a failed delivery would otherwise
    // leave an "active" code the student never received — and the resend
    // cooldown above would then silently swallow their retry for a minute.
    // Burn it so the next attempt issues a fresh code.
    await phoneOtpsRepository.markConsumed(row.id);
    throw err;
  }
}

/** Returns true and consumes the code on success. */
export async function verifyPhoneOtp(
  phone: string,
  code: string,
): Promise<boolean> {
  const active = await phoneOtpsRepository.findActive(phone);
  if (!active) return false;
  const ok = await verifyPassword(active.codeHash, code);
  if (!ok) {
    // Burn the code once the guess budget is spent, so an attacker cannot keep
    // working the same short code for the rest of its five-minute life. The
    // student can request a fresh one after the resend cooldown.
    const attempts = await phoneOtpsRepository.recordFailedAttempt(active.id);
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await phoneOtpsRepository.markConsumed(active.id);
    }
    return false;
  }
  await phoneOtpsRepository.markConsumed(active.id);
  return true;
}

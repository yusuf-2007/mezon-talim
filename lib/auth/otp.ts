import "server-only";
import { randomInt } from "node:crypto";
import { hashPassword, verifyPassword } from "./password";
import { phoneOtpsRepository } from "@/lib/db/repositories/phone-otps";
import { getSmsSender } from "@/lib/notifications";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends

/**
 * Phone OTP issuance + verification (Eskiz-backed; dev-console fallback).
 * Codes are 6 digits, stored hashed (argon2), single-use, and time-boxed.
 * This is the engine behind the gated phone-login flow.
 */
export async function requestPhoneOtp(phone: string): Promise<void> {
  const active = await phoneOtpsRepository.findActive(phone);
  if (active && Date.now() - active.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    // Don't reissue too frequently; the existing code is still valid.
    return;
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await phoneOtpsRepository.create(phone, codeHash, expiresAt);

  await getSmsSender().send({
    to: phone,
    text: `Mezon Ta'lim: tasdiqlash kodi ${code}. 5 daqiqa amal qiladi.`,
  });
}

/** Returns true and consumes the code on success. */
export async function verifyPhoneOtp(
  phone: string,
  code: string,
): Promise<boolean> {
  const active = await phoneOtpsRepository.findActive(phone);
  if (!active) return false;
  const ok = await verifyPassword(active.codeHash, code);
  if (!ok) return false;
  await phoneOtpsRepository.markConsumed(active.id);
  return true;
}

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * HMAC-SHA256 over an application secret, for values that leave the server and
 * must come back unmodified — a phone number banked between two requests, a
 * notification id embedded in a delivery-report URL.
 *
 * This is not encryption: the payload stays readable. It only proves we wrote
 * it, which is the property these callers need.
 */

function secret(): string {
  // Auth.js already requires this in production; failing loudly here beats
  // silently signing with a constant an attacker could guess.
  const s = env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is required to sign values");
  return s;
}

export function signPayload(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * Constant-time comparison that tolerates a length mismatch without throwing —
 * `timingSafeEqual` rejects differing lengths, and an attacker controls the
 * length of whatever they send us.
 */
export function signatureMatches(payload: string, provided: string): boolean {
  const expected = Buffer.from(signPayload(payload));
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

import "server-only";
import { cookies } from "next/headers";
import { signPayload, signatureMatches } from "@/lib/signing";

/**
 * Proof that a phone number was verified by OTP moments ago.
 *
 * The unified entry screen cannot know whether a number belongs to an existing
 * account until the code is checked, and checking the code consumes it. So the
 * check happens once, here the result is banked, and whichever branch follows —
 * sign in, or ask an unrecognised number for a name and then create the
 * account — presents this ticket instead of the spent code.
 *
 * The alternatives were both worse: re-checking the same code in a second
 * request means it cannot be single-use, and creating the account up front
 * litters the users table with nameless rows whenever someone abandons the
 * form.
 *
 * A signed cookie holds the number — httpOnly so no script can read it, HMAC'd
 * so the browser cannot edit which number it names, and short-lived so a
 * forgotten tab is not a standing offer to sign in as someone else. It is
 * cleared the moment it is spent.
 */

const COOKIE_NAME = "mt_phone_ticket";
const TTL_MS = 10 * 60 * 1000;

const b64url = (b: Buffer) => b.toString("base64url");

export async function issuePhoneTicket(phone: string): Promise<void> {
  const payload = `${phone}.${Date.now() + TTL_MS}`;
  const token = `${b64url(Buffer.from(payload))}.${signPayload(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

/** The raw cookie value, to hand to the credentials provider. */
export async function readPhoneTicketToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE_NAME)?.value ?? null;
}

/** The verified phone number, or null if absent, tampered with, or expired. */
export async function readPhoneTicket(): Promise<string | null> {
  const raw = await readPhoneTicketToken();
  return raw ? parsePhoneTicket(raw) : null;
}

/**
 * Exported separately from the cookie read because the Auth.js `authorize`
 * callback validates a ticket it was handed as a credential — it runs outside
 * the request scope that `cookies()` needs.
 */
export function parsePhoneTicket(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;

  const encoded = token.slice(0, dot);
  const provided = token.slice(dot + 1);

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!signatureMatches(payload, provided)) return null;

  // Only split the payload once the signature checks out, so nothing derived
  // from unverified bytes is ever trusted.
  const sep = payload.lastIndexOf(".");
  if (sep < 1) return null;
  const phone = payload.slice(0, sep);
  const expiresAt = Number(payload.slice(sep + 1));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  return phone;
}

export async function clearPhoneTicket(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

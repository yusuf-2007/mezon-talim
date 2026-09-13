import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { usersRepository } from "@/lib/db/repositories/users";
import { isUniqueViolation } from "@/lib/db/errors";
import { verifyPassword } from "./password";
import { parsePhoneTicket } from "./phone-ticket";
import { completePhoneSignupSchema, loginSchema, phoneSchema } from "./schemas";
import type { Role } from "./types";

/** Shape returned to Auth.js from `authorize` and carried into the JWT. */
export type AuthUser = {
  id: string;
  role: Role;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  locale: "uz" | "ru";
  name: string | null;
};

type DbUser = NonNullable<Awaited<ReturnType<typeof usersRepository.findById>>>;

function toAuthUser(u: DbUser): AuthUser {
  return {
    id: u.id,
    role: u.role,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    locale: u.locale === "ru" ? "ru" : "uz",
    name: u.fullName ?? u.name ?? null,
  };
}

/** Email + password login. Returns null on any failure (no user enumeration). */
export async function verifyPasswordLogin(
  raw: unknown,
): Promise<AuthUser | null> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return null;

  const user = await usersRepository.findByEmail(parsed.data.email);
  if (!user?.passwordHash) return null;

  const ok = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!ok) return null;
  if (!user.isActive) return null; // deactivated accounts can't sign in

  return toAuthUser(user);
}

const phoneTicketSchema = z.object({
  ticket: z.string().min(1),
  // Present only on the sign-up branch; an existing account ignores them.
  fullName: z.string().optional(),
  occupation: z.string().optional(),
});

/**
 * Phone sign-in and sign-up, both proven by a phone ticket rather than by the
 * OTP itself (see ./phone-ticket for why the code cannot be re-checked here).
 *
 * Hard-gated by OTP_LOGIN_ENABLED — defence in depth, since the UI is gated
 * too. The ticket is the only thing that authorises this path, so it is parsed
 * before anything else is read.
 */
export async function verifyPhoneTicket(raw: unknown): Promise<AuthUser | null> {
  if (!env.OTP_LOGIN_ENABLED) return null;

  const parsed = phoneTicketSchema.safeParse(raw);
  if (!parsed.success) return null;

  const ticketPhone = parsePhoneTicket(parsed.data.ticket);
  if (!ticketPhone) return null;

  // Re-validate the number the ticket names. The ticket is ours and signed, so
  // this should never fail — but it is the value that becomes a unique account
  // key, and a signature only proves we wrote it, not that we wrote it well.
  const phone = phoneSchema.safeParse(ticketPhone);
  if (!phone.success) return null;

  const existing = await usersRepository.findByPhone(phone.data);
  if (existing) {
    if (!existing.isActive) return null; // deactivated accounts can't sign in
    return toAuthUser(existing);
  }

  // First sign-in for this number: the profile fields must come with it, so an
  // account never exists in a nameless half-state.
  const profile = completePhoneSignupSchema.safeParse({
    fullName: parsed.data.fullName ?? "",
    occupation: parsed.data.occupation ?? "",
  });
  if (!profile.success) return null;

  try {
    const created = await usersRepository.createWithPhone({
      phone: phone.data,
      fullName: profile.data.fullName,
      occupation: profile.data.occupation ?? null,
    });
    return toAuthUser(created);
  } catch (err) {
    // Two tabs finishing the same sign-up, or a retry after a slow insert: the
    // row the second attempt lost to is the one we wanted, so adopt it.
    if (!isUniqueViolation(err)) throw err;
    const raced = await usersRepository.findByPhone(phone.data);
    if (!raced?.isActive) return null;
    return toAuthUser(raced);
  }
}

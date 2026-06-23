import "server-only";
import { env } from "@/lib/env";
import { usersRepository } from "@/lib/db/repositories/users";
import { verifyPassword } from "./password";
import { verifyPhoneOtp } from "./otp";
import { loginSchema, verifyOtpSchema } from "./schemas";
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

  return toAuthUser(user);
}

/**
 * Phone + OTP login. Hard-gated by OTP_LOGIN_ENABLED (defense in depth — the UI
 * is also gated). Creates the user on first verified login.
 */
export async function verifyOtpLogin(raw: unknown): Promise<AuthUser | null> {
  if (!env.OTP_LOGIN_ENABLED) return null;

  const parsed = verifyOtpSchema.safeParse(raw);
  if (!parsed.success) return null;

  const ok = await verifyPhoneOtp(parsed.data.phone, parsed.data.code);
  if (!ok) return null;

  const user = await usersRepository.findOrCreateByPhone(parsed.data.phone);
  await usersRepository.markPhoneVerified(user.id);
  return toAuthUser(user);
}

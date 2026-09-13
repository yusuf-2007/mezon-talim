import "server-only";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { auth, unstable_update } from "./config";
import type { Role, SessionUser } from "./types";

export type { Role, SessionUser } from "./types";
export { signIn, signOut } from "./config";

/**
 * Force the session cookie to catch up with the database.
 *
 * Sessions are JWTs, so identity fields are a snapshot taken at sign-in: adding
 * an email or a phone, or renaming, leaves the cookie describing an account
 * shape that no longer exists. Any action that changes one of those fields must
 * call this. The jwt callback re-reads the row rather than trusting a patch, so
 * there is nothing to pass here.
 */
export async function refreshSession(): Promise<void> {
  await unstable_update({ user: {} });
}

/**
 * Auth access helpers — the ONLY way app code reads the current user or guards
 * by role (CLAUDE.md §2.5, §8). Components/route handlers never call the Auth.js
 * SDK directly; they call these. Redirects preserve the active request locale.
 */

/**
 * Returns the signed-in user, or null if anonymous. A session cookie that can't
 * be decoded (e.g. encrypted under a rotated AUTH_SECRET, or otherwise corrupt)
 * is treated as logged-out rather than crashing the request — Auth.js throws a
 * JWTSessionError in that case.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  let session;
  try {
    session = await auth();
  } catch {
    return null;
  }
  if (!session?.user?.id) return null;
  const u = session.user;
  return {
    id: u.id,
    role: u.role,
    fullName: u.fullName,
    email: u.email ?? null,
    phone: u.phone,
    locale: u.locale,
  };
}

/** Asserts an authenticated user; redirects to the localized login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) return redirectLocalized("/login");
  return user;
}

/**
 * Asserts an authenticated user whose role is in `allowed`. Redirects anonymous
 * users to login and authenticated-but-unauthorized users to a 403 page.
 */
export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) return redirectLocalized("/login");
  if (!allowed.includes(user.role)) return redirectLocalized("/forbidden");
  return user;
}

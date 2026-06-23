import "server-only";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { auth } from "./config";
import type { Role, SessionUser } from "./types";

export type { Role, SessionUser } from "./types";
export { signIn, signOut } from "./config";

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

import "server-only";
import type { Role, SessionUser } from "./types";

export type { Role, SessionUser } from "./types";

/**
 * Auth access helpers — the ONLY way app code reads the current user or guards
 * a route by role (CLAUDE.md §2.5, §8). Components/route handlers never call the
 * Auth.js SDK directly.
 *
 * Phase 1 ships the typed contract only. Phase 2 wires Auth.js v5 (Credentials:
 * email+password via argon2, phone OTP via Eskiz) and the Drizzle adapter.
 */

const NOT_IMPLEMENTED =
  "lib/auth: not implemented until Phase 2 (Auth & 4 roles).";

/** Returns the signed-in user, or null if anonymous. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  // TODO(phase-2): read the Auth.js session and map to SessionUser.
  throw new Error(NOT_IMPLEMENTED);
}

/**
 * Asserts an authenticated user whose role is in `allowed`; otherwise redirects
 * to login / 403. Returns the user for convenience.
 */
export async function requireRole(
  ..._allowed: Role[]
): Promise<SessionUser> {
  // TODO(phase-2): enforce auth + role, redirect on failure.
  throw new Error(NOT_IMPLEMENTED);
}

/** Convenience guard: any authenticated user. */
export async function requireUser(): Promise<SessionUser> {
  // TODO(phase-2).
  throw new Error(NOT_IMPLEMENTED);
}

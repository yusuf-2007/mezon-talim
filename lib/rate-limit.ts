import "server-only";
import { rateLimitsRepository } from "@/lib/db/repositories/rate-limits";

/**
 * Fixed-window rate limiter backed by Postgres, so limits hold across
 * serverless instances and survive deploys (the old in-process Map did
 * neither). FAIL-OPEN: if the DB check itself errors, the request is allowed —
 * availability wins, because none of these limits are security-critical (all
 * exam gating is enforced separately in the service layer); they just blunt
 * abusive bursts (spec Part 4 #7).
 */

export type RateLimitResult = { ok: boolean; retryAfterMs: number };

/**
 * Allow up to `limit` events per `windowMs` for `key`. Returns ok=false with
 * the ms until the window resets when exceeded.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  try {
    const { count, windowStart } = await rateLimitsRepository.hit(key, windowMs);
    if (count <= limit) return { ok: true, retryAfterMs: 0 };
    const retryAfterMs = Math.max(0, windowStart.getTime() + windowMs - Date.now());
    return { ok: false, retryAfterMs };
  } catch (err) {
    console.error("[rate-limit] check failed — allowing request:", err);
    return { ok: true, retryAfterMs: 0 };
  } finally {
    // Opportunistic sweep of long-expired counters (~1% of hits).
    if (Math.random() < 0.01) {
      void rateLimitsRepository.sweep().catch(() => {});
    }
  }
}

/**
 * Forget a counter.
 *
 * A brute-force budget exists to bound *guessing*, and a correct password is
 * proof the attempt was not a guess — so counting successes against it only
 * punishes people who sign in often, and eventually locks them out for being
 * legitimate users.
 *
 * Fail-open like the rest of this module: a limiter that cannot be cleared
 * should not break the sign-in that just succeeded.
 */
export async function clearRateLimit(key: string): Promise<void> {
  try {
    await rateLimitsRepository.clear(key);
  } catch (err) {
    console.error("[rate-limit] clear failed — counter left in place:", err);
  }
}

const MIN = 60_000;

/** Per-action exam limits (spec 1.5). Keyed by action + user id. */
export const EXAM_LIMITS = {
  start: { limit: 20, windowMs: 10 * MIN },
  save: { limit: 900, windowMs: 10 * MIN },
  submit: { limit: 30, windowMs: 10 * MIN },
  retry: { limit: 15, windowMs: 60 * MIN },
} as const;

export type ExamAction = keyof typeof EXAM_LIMITS;

/** Convenience wrapper: enforce an exam action's limit for a user. */
export async function checkExamRateLimit(
  action: ExamAction,
  userId: string,
): Promise<RateLimitResult> {
  const { limit, windowMs } = EXAM_LIMITS[action];
  return checkRateLimit(`exam:${action}:${userId}`, limit, windowMs);
}

import "server-only";

/**
 * Minimal in-process rate limiter (fixed-window per key). Suited to the
 * single-instance in-country VPS deploy (modular monolith) — no Redis needed.
 * If this ever scales horizontally, swap the Map for a shared store behind the
 * same `checkRateLimit` signature.
 *
 * Not security-critical on its own (all exam gating is enforced server-side in
 * the service layer) — this just blunts abusive bursts (spec Part 4 #7).
 */

type Window = { count: number; resetAt: number };
const store = new Map<string, Window>();

// Opportunistic cleanup so the Map can't grow unbounded across long uptimes.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, w] of store) if (w.resetAt <= now) store.delete(k);
}

export type RateLimitResult = { ok: boolean; retryAfterMs: number };

/**
 * Allow up to `limit` events per `windowMs` for `key`. Returns ok=false with the
 * ms until the window resets when exceeded.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  sweep(now);
  const w = store.get(key);
  if (!w || w.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (w.count >= limit) {
    return { ok: false, retryAfterMs: w.resetAt - now };
  }
  w.count += 1;
  return { ok: true, retryAfterMs: 0 };
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
export function checkExamRateLimit(
  action: ExamAction,
  userId: string,
): RateLimitResult {
  const { limit, windowMs } = EXAM_LIMITS[action];
  return checkRateLimit(`exam:${action}:${userId}`, limit, windowMs);
}

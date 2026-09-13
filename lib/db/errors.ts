import "server-only";

/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION = "23505";

/**
 * True when an insert/update lost a race against a uniqueness constraint.
 *
 * Checking a column is free before writing it is never sufficient on its own —
 * `users.email` and `users.phone` are both unique, and between the check and
 * the write another request can claim the value. Callers use this to turn the
 * resulting crash into an ordinary "already taken" field error.
 */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

/**
 * THE definition of "passed an assessment", shared by every gate that keys off
 * a pass: the final-exam prerequisite chain, course- and module-certificate
 * eligibility, the exam overview, answer review and the student dashboard.
 *
 * A pass counts only when the attempt was submitted, graded as passed, and NOT
 * voided. Voiding is the admin "grant retry" action — a voided attempt is
 * treated as if it never happened, so a voided pass must not keep unlocking
 * the final exam or minting a certificate while the exam page says "not passed".
 *
 * The SQL twin of this predicate is `passedAttemptWhere` in
 * lib/db/repositories/attempts.ts; change both together.
 */
export type AttemptPassFields = {
  passed: boolean | null;
  voided: boolean;
  submittedAt: Date | null;
};

export function isCountedPass(a: AttemptPassFields): boolean {
  return a.submittedAt != null && a.passed === true && !a.voided;
}

import "server-only";
import { paymentsRepository } from "@/lib/db/repositories/payments";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";

/**
 * Provider-agnostic payment lifecycle. The Click and Payme webhook handlers call
 * into here; enrollment is created ONLY via `markPaidAndEnroll`, which is the
 * single place a verified `paid` becomes access (CLAUDE.md non-negotiable).
 */
export type PaymeMeta = {
  paymeTransactionId?: string;
  state?: number; // Payme transaction state (1 created, 2 performed, -1/-2 cancelled)
  createTime?: number;
  performTime?: number;
  cancelTime?: number;
  reason?: number | null;
};

/** Create a pending payment for a course purchase (reuses an open one). */
export async function createPendingPayment(input: {
  userId: string;
  courseId: string;
  provider: "click" | "payme";
}) {
  const course = await coursesRepository.findById(input.courseId);
  if (!course || course.status !== "published") {
    throw new Error("Course not available for purchase");
  }
  const existing = await paymentsRepository.findReusablePending(
    input.userId,
    input.courseId,
    input.provider,
  );
  const payment =
    existing ??
    (await paymentsRepository.createPending({
      userId: input.userId,
      courseId: input.courseId,
      provider: input.provider,
      amountTiyin: course.priceTiyin,
    }));
  return { payment, course };
}

/**
 * Mark a payment paid and create the enrollment. Idempotent: a second call for
 * an already-paid payment is a no-op (returns early), so retried callbacks are
 * safe.
 */
export async function markPaidAndEnroll(
  paymentId: string,
  opts: { providerTxnId: string; idempotencyKey: string; raw?: unknown },
): Promise<void> {
  const payment = await paymentsRepository.findById(paymentId);
  if (!payment) throw new Error("Payment not found");
  if (payment.status === "paid") return; // already processed

  const course = await coursesRepository.findById(payment.courseId);
  if (!course) throw new Error("Course not found");

  await paymentsRepository.update(paymentId, {
    status: "paid",
    providerTxnId: opts.providerTxnId,
    idempotencyKey: opts.idempotencyKey,
    rawCallback: opts.raw ?? null,
  });

  await enrollmentsRepository.enroll({
    userId: payment.userId,
    courseId: payment.courseId,
    accessDurationDays: course.accessDurationDays,
    sourcePaymentId: payment.id,
  });
}

/** Mark a payment refunded/cancelled (e.g. Payme CancelTransaction). */
export async function markCancelled(
  paymentId: string,
  opts: { raw?: unknown } = {},
): Promise<void> {
  const payment = await paymentsRepository.findById(paymentId);
  if (!payment) return;
  await paymentsRepository.update(paymentId, {
    status: "refunded",
    rawCallback: opts.raw ?? payment.rawCallback,
  });
  // TODO(phase-9): reflect refund on the enrollment (status='refunded') + audit.
}

/** Merge Payme transaction metadata into raw_callback. */
export function buildPaymeRaw(prev: unknown, meta: PaymeMeta): unknown {
  const base =
    prev && typeof prev === "object" ? (prev as Record<string, unknown>) : {};
  return { ...base, payme: { ...(base.payme as object), ...meta } };
}

export function readPaymeMeta(raw: unknown): PaymeMeta {
  if (raw && typeof raw === "object" && "payme" in raw) {
    return (raw as { payme: PaymeMeta }).payme ?? {};
  }
  return {};
}

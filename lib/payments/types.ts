/**
 * Payment provider abstraction. Click and Payme both implement this so the
 * webhook route handlers stay provider-agnostic. Amounts are integer tiyin
 * (UZS × 100) end-to-end — never float.
 *
 * Enrollment is created/activated ONLY after `verifyCallback` confirms a
 * server-verified `paid` state (Payme JSON-RPC; Click Prepare/Complete + MD5).
 */
export type PaymentProviderId = "click" | "payme";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface CreateChargeInput {
  paymentId: string; // our payments.id
  amountTiyin: number;
  courseId: string;
  userId: string;
  returnUrl: string;
}

export interface CreateChargeResult {
  /** Provider checkout URL to redirect the user to. */
  checkoutUrl: string;
}

export interface VerifiedCallback {
  paymentId: string;
  provider: PaymentProviderId;
  status: PaymentStatus;
  amountTiyin: number;
  providerTxnId: string;
  idempotencyKey: string;
  raw: unknown;
}

/** A provider response already shaped for the wire (provider-specific body). */
export interface ProviderResponse {
  status: number;
  body: unknown;
}

export interface PaymentAdapter {
  readonly id: PaymentProviderId;
  /** Begin a charge and return the provider checkout URL. */
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  /**
   * Verify an inbound webhook (signature + amount) and normalize it. Throws or
   * returns a non-paid status if verification fails — callers must not enroll
   * on anything but a verified `paid`.
   */
  verifyCallback(request: Request): Promise<VerifiedCallback>;
  /** Build the provider-expected acknowledgement response. */
  ack(callback: VerifiedCallback): ProviderResponse;
}

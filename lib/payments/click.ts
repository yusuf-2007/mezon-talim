import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { paymentsRepository } from "@/lib/db/repositories/payments";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { markPaidAndEnroll } from "./service";

/**
 * Click "SHOP API" integration (docs.click.uz). Two server-to-server callbacks:
 *  - Prepare  (action=0): validate the order, reserve, return merchant_prepare_id
 *  - Complete (action=1): confirm payment → mark paid + enroll
 *
 * Each request carries an MD5 `sign_string`; we recompute and constant-time
 * compare it before trusting anything. Click `amount` is in so'm (decimal), so
 * we compare against priceTiyin/100. Enrollment happens ONLY on a verified
 * Complete with action=1 and matching amount.
 */

export const CLICK_ERR = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INVALID_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  FAILED_TO_UPDATE: -7,
  BAD_REQUEST: -8,
  TRANSACTION_CANCELLED: -9,
} as const;

export function isClickConfigured(): boolean {
  return Boolean(
    env.CLICK_SERVICE_ID && env.CLICK_MERCHANT_ID && env.CLICK_SECRET_KEY,
  );
}

/** Hosted checkout URL the buyer is redirected to. */
export function clickCheckoutUrl(paymentId: string, amountSom: number, returnUrl: string) {
  const params = new URLSearchParams({
    service_id: env.CLICK_SERVICE_ID ?? "",
    merchant_id: env.CLICK_MERCHANT_ID ?? "",
    amount: amountSom.toString(),
    transaction_param: paymentId, // echoed back as merchant_trans_id
    return_url: returnUrl,
  });
  return `https://my.click.uz/services/pay?${params.toString()}`;
}

type ClickParams = {
  click_trans_id: string;
  service_id: string;
  click_paydoc_id?: string;
  merchant_trans_id: string; // our payment id
  merchant_prepare_id?: string;
  amount: string;
  action: string; // "0" prepare, "1" complete
  error?: string;
  error_note?: string;
  sign_time: string;
  sign_string: string;
};

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

/** Verify the MD5 sign_string for a Prepare/Complete request. */
function verifySign(p: ClickParams): boolean {
  const secret = env.CLICK_SECRET_KEY ?? "";
  // Complete includes merchant_prepare_id; Prepare does not.
  const base =
    p.action === "1"
      ? p.click_trans_id +
        p.service_id +
        secret +
        p.merchant_trans_id +
        (p.merchant_prepare_id ?? "") +
        p.amount +
        p.action +
        p.sign_time
      : p.click_trans_id +
        p.service_id +
        secret +
        p.merchant_trans_id +
        p.amount +
        p.action +
        p.sign_time;
  return timingSafeEqualHex(md5(base), (p.sign_string ?? "").toLowerCase());
}

function reply(error: number, error_note: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error, error_note, ...extra });
}

/** Handle a Click Prepare/Complete callback (application/x-www-form-urlencoded). */
export async function handleClickWebhook(request: Request): Promise<Response> {
  const form = await request.formData();
  const p = Object.fromEntries(form.entries()) as unknown as ClickParams;

  if (!verifySign(p)) {
    return reply(CLICK_ERR.SIGN_CHECK_FAILED, "Sign check failed");
  }

  const payment = await paymentsRepository.findById(p.merchant_trans_id);
  if (!payment) {
    return reply(CLICK_ERR.USER_NOT_FOUND, "Order not found");
  }
  if (payment.status === "refunded" || payment.status === "failed") {
    return reply(CLICK_ERR.TRANSACTION_CANCELLED, "Transaction cancelled");
  }

  // Amount check: Click amount is in so'm; our order is in tiyin.
  const course = await coursesRepository.findById(payment.courseId);
  const expectedSom = (course?.priceTiyin ?? payment.amountTiyin) / 100;
  if (Math.abs(parseFloat(p.amount) - expectedSom) > 0.01) {
    return reply(CLICK_ERR.INVALID_AMOUNT, "Incorrect amount");
  }

  if (p.action === "0") {
    // Prepare: acknowledge and echo a prepare id (we reuse our payment id).
    return reply(CLICK_ERR.SUCCESS, "Success", {
      click_trans_id: p.click_trans_id,
      merchant_trans_id: p.merchant_trans_id,
      merchant_prepare_id: payment.id,
    });
  }

  if (p.action === "1") {
    // Complete: a provider-reported error cancels the order.
    if (p.error && Number(p.error) < 0) {
      await paymentsRepository.update(payment.id, {
        status: "failed",
        rawCallback: p,
      });
      return reply(CLICK_ERR.TRANSACTION_CANCELLED, "Cancelled by Click");
    }
    if (payment.status === "paid") {
      return reply(CLICK_ERR.ALREADY_PAID, "Already paid");
    }
    await markPaidAndEnroll(payment.id, {
      providerTxnId: String(p.click_trans_id),
      idempotencyKey: `click:${p.click_trans_id}`,
      raw: p,
    });
    return reply(CLICK_ERR.SUCCESS, "Success", {
      click_trans_id: p.click_trans_id,
      merchant_trans_id: p.merchant_trans_id,
      merchant_confirm_id: payment.id,
    });
  }

  return reply(CLICK_ERR.ACTION_NOT_FOUND, "Action not found");
}

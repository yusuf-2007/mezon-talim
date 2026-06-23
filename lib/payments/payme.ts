import "server-only";
import { env } from "@/lib/env";
import { paymentsRepository } from "@/lib/db/repositories/payments";
import {
  buildPaymeRaw,
  markCancelled,
  markPaidAndEnroll,
  readPaymeMeta,
} from "./service";

/**
 * Payme Merchant API (JSON-RPC 2.0, developer.help.paycom.uz). One endpoint
 * dispatches CheckPerformTransaction / CreateTransaction / PerformTransaction /
 * CancelTransaction / CheckTransaction / GetStatement. Auth is HTTP Basic
 * `Paycom:<PAYME_KEY>`. Amounts are in tiyin — matching our storage exactly.
 *
 * Transaction state is tracked on the payment row's raw_callback (no schema
 * change). Enrollment happens only in PerformTransaction via markPaidAndEnroll.
 */

const PAYME_ERR = {
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_PERFORM: -31008,
  CANNOT_CANCEL: -31007,
  ORDER_NOT_FOUND: -31050, // custom account-range error
  INSUFFICIENT_PRIVILEGE: -32504,
  METHOD_NOT_FOUND: -32601,
  PARSE_ERROR: -32700,
} as const;

// Payme transaction states.
const STATE = { CREATED: 1, PERFORMED: 2, CANCELLED: -1, CANCELLED_AFTER: -2 };
const TRANSACTION_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12h

export function isPaymeConfigured(): boolean {
  return Boolean(env.PAYME_MERCHANT_ID && env.PAYME_KEY);
}

/** Hosted checkout: base64 of `m=<merchant>;ac.order_id=<id>;a=<tiyin>;c=<return>`. */
export function paymeCheckoutUrl(paymentId: string, amountTiyin: number, returnUrl: string) {
  const raw = `m=${env.PAYME_MERCHANT_ID};ac.order_id=${paymentId};a=${amountTiyin};c=${returnUrl}`;
  return `https://checkout.paycom.uz/${Buffer.from(raw).toString("base64")}`;
}

type Rpc = { method?: string; params?: Record<string, unknown>; id?: unknown };

function ok(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}
function err(id: unknown, code: number, msg: string, data?: unknown) {
  return Response.json({
    jsonrpc: "2.0",
    id,
    error: { code, message: { ru: msg, uz: msg, en: msg }, data },
  });
}

/** Constant-time-ish check of the Basic auth password against PAYME_KEY. */
function authOk(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    const pass = idx >= 0 ? decoded.slice(idx + 1) : "";
    return pass === env.PAYME_KEY;
  } catch {
    return false;
  }
}

function orderId(params: Record<string, unknown> | undefined): string | null {
  const account = params?.account as Record<string, unknown> | undefined;
  const v = account?.order_id;
  return typeof v === "string" ? v : null;
}

export async function handlePaymeWebhook(request: Request): Promise<Response> {
  let body: Rpc;
  try {
    body = (await request.json()) as Rpc;
  } catch {
    return err(null, PAYME_ERR.PARSE_ERROR, "Parse error");
  }
  const { id, method, params = {} } = body;

  if (!authOk(request)) {
    return err(id, PAYME_ERR.INSUFFICIENT_PRIVILEGE, "Insufficient privilege");
  }

  switch (method) {
    case "CheckPerformTransaction":
      return checkPerform(id, params);
    case "CreateTransaction":
      return createTransaction(id, params);
    case "PerformTransaction":
      return performTransaction(id, params);
    case "CancelTransaction":
      return cancelTransaction(id, params);
    case "CheckTransaction":
      return checkTransaction(id, params);
    case "GetStatement":
      return ok(id, { transactions: [] });
    default:
      return err(id, PAYME_ERR.METHOD_NOT_FOUND, "Method not found");
  }
}

async function checkPerform(id: unknown, params: Record<string, unknown>) {
  const oid = orderId(params);
  if (!oid) return err(id, PAYME_ERR.ORDER_NOT_FOUND, "Order not found");
  const payment = await paymentsRepository.findById(oid);
  if (!payment) return err(id, PAYME_ERR.ORDER_NOT_FOUND, "Order not found");
  if (Number(params.amount) !== payment.amountTiyin) {
    return err(id, PAYME_ERR.INVALID_AMOUNT, "Invalid amount");
  }
  if (payment.status === "paid") {
    return err(id, PAYME_ERR.CANNOT_PERFORM, "Already paid");
  }
  return ok(id, { allow: true });
}

async function createTransaction(id: unknown, params: Record<string, unknown>) {
  const paymeId = String(params.id);
  const existing = await paymentsRepository.findByIdempotencyKey(`payme:${paymeId}`);
  if (existing) {
    const meta = readPaymeMeta(existing.rawCallback);
    if (existing.status === "paid" || meta.state === STATE.PERFORMED) {
      return err(id, PAYME_ERR.CANNOT_PERFORM, "Already performed");
    }
    // Idempotent re-create.
    return ok(id, {
      create_time: meta.createTime ?? Date.now(),
      transaction: existing.id,
      state: STATE.CREATED,
    });
  }

  const oid = orderId(params);
  if (!oid) return err(id, PAYME_ERR.ORDER_NOT_FOUND, "Order not found");
  const payment = await paymentsRepository.findById(oid);
  if (!payment) return err(id, PAYME_ERR.ORDER_NOT_FOUND, "Order not found");
  if (Number(params.amount) !== payment.amountTiyin) {
    return err(id, PAYME_ERR.INVALID_AMOUNT, "Invalid amount");
  }
  if (payment.status === "paid") {
    return err(id, PAYME_ERR.CANNOT_PERFORM, "Already paid");
  }
  // Another active Payme transaction already owns this order.
  const ownerMeta = readPaymeMeta(payment.rawCallback);
  if (ownerMeta.paymeTransactionId && ownerMeta.paymeTransactionId !== paymeId) {
    return err(id, PAYME_ERR.CANNOT_PERFORM, "Order already has a transaction");
  }
  // Reject stale create requests (>12h old).
  const time = Number(params.time);
  if (time && Date.now() - time > TRANSACTION_TIMEOUT_MS) {
    return err(id, PAYME_ERR.CANNOT_PERFORM, "Transaction timed out");
  }

  const createTime = Date.now();
  await paymentsRepository.update(payment.id, {
    providerTxnId: paymeId,
    idempotencyKey: `payme:${paymeId}`,
    rawCallback: buildPaymeRaw(payment.rawCallback, {
      paymeTransactionId: paymeId,
      state: STATE.CREATED,
      createTime,
    }),
  });
  return ok(id, {
    create_time: createTime,
    transaction: payment.id,
    state: STATE.CREATED,
  });
}

async function performTransaction(id: unknown, params: Record<string, unknown>) {
  const paymeId = String(params.id);
  const payment = await paymentsRepository.findByIdempotencyKey(`payme:${paymeId}`);
  if (!payment) {
    return err(id, PAYME_ERR.TRANSACTION_NOT_FOUND, "Transaction not found");
  }
  const meta = readPaymeMeta(payment.rawCallback);

  if (payment.status === "paid" || meta.state === STATE.PERFORMED) {
    return ok(id, {
      transaction: payment.id,
      perform_time: meta.performTime ?? Date.now(),
      state: STATE.PERFORMED,
    });
  }
  if (meta.state !== STATE.CREATED) {
    return err(id, PAYME_ERR.CANNOT_PERFORM, "Cannot perform");
  }

  const performTime = Date.now();
  await markPaidAndEnroll(payment.id, {
    providerTxnId: paymeId,
    idempotencyKey: `payme:${paymeId}`,
    raw: buildPaymeRaw(payment.rawCallback, {
      ...meta,
      state: STATE.PERFORMED,
      performTime,
    }),
  });
  return ok(id, {
    transaction: payment.id,
    perform_time: performTime,
    state: STATE.PERFORMED,
  });
}

async function cancelTransaction(id: unknown, params: Record<string, unknown>) {
  const paymeId = String(params.id);
  const payment = await paymentsRepository.findByIdempotencyKey(`payme:${paymeId}`);
  if (!payment) {
    return err(id, PAYME_ERR.TRANSACTION_NOT_FOUND, "Transaction not found");
  }
  const meta = readPaymeMeta(payment.rawCallback);

  // Already cancelled → idempotent.
  if (meta.state === STATE.CANCELLED || meta.state === STATE.CANCELLED_AFTER) {
    return ok(id, {
      transaction: payment.id,
      cancel_time: meta.cancelTime ?? Date.now(),
      state: meta.state,
    });
  }

  const cancelTime = Date.now();
  const newState =
    meta.state === STATE.PERFORMED ? STATE.CANCELLED_AFTER : STATE.CANCELLED;
  const reason = Number(params.reason) || null;

  if (newState === STATE.CANCELLED_AFTER) {
    await markCancelled(payment.id, {
      raw: buildPaymeRaw(payment.rawCallback, {
        ...meta,
        state: newState,
        cancelTime,
        reason,
      }),
    });
  } else {
    await paymentsRepository.update(payment.id, {
      status: "failed",
      rawCallback: buildPaymeRaw(payment.rawCallback, {
        ...meta,
        state: newState,
        cancelTime,
        reason,
      }),
    });
  }
  return ok(id, {
    transaction: payment.id,
    cancel_time: cancelTime,
    state: newState,
  });
}

async function checkTransaction(id: unknown, params: Record<string, unknown>) {
  const paymeId = String(params.id);
  const payment = await paymentsRepository.findByIdempotencyKey(`payme:${paymeId}`);
  if (!payment) {
    return err(id, PAYME_ERR.TRANSACTION_NOT_FOUND, "Transaction not found");
  }
  const meta = readPaymeMeta(payment.rawCallback);
  return ok(id, {
    create_time: meta.createTime ?? 0,
    perform_time: meta.performTime ?? 0,
    cancel_time: meta.cancelTime ?? 0,
    transaction: payment.id,
    state: meta.state ?? STATE.CREATED,
    reason: meta.reason ?? null,
  });
}

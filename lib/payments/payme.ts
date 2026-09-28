import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { paymentsRepository } from "@/lib/db/repositories/payments";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { pickLocale } from "@/lib/i18n/localized";
import {
  buildPaymeRaw,
  markCancelled,
  markPaidAndEnroll,
  readPaymeMeta,
  type PaymeMeta,
} from "./service";

/**
 * Payme Merchant API (JSON-RPC 2.0, developer.help.paycom.uz).
 *
 * One endpoint, the six methods Payme's integration team asked for:
 * CheckPerformTransaction, CreateTransaction, PerformTransaction,
 * CancelTransaction, CheckTransaction and GetStatement. ChangePassword is
 * deliberately absent — they confirmed it is not required.
 *
 * Auth is HTTP Basic `Paycom:<PAYME_KEY>`. Every response is HTTP 200; errors
 * travel inside the JSON-RPC body, as the protocol requires. Amounts are tiyin,
 * which is also how we store them, so nothing is ever converted.
 *
 * One of our payment rows is one Payme "order" (`account.order_id`). Payme's
 * transaction state lives on the row's raw_callback. Access is granted in
 * exactly one place — PerformTransaction, via markPaidAndEnroll — and revoked
 * in exactly one — CancelTransaction after perform, via markCancelled.
 */

const ERR = {
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_CANCEL: -31007,
  CANNOT_PERFORM: -31008,
  // Account errors must sit in -31050..-31099 and name the offending field.
  ORDER_NOT_FOUND: -31050,
  ORDER_NOT_PAYABLE: -31051,
  ORDER_BUSY: -31052,
  INSUFFICIENT_PRIVILEGE: -32504,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  PARSE_ERROR: -32700,
} as const;

/** Payme shows these to the payer, so they are real sentences in three languages. */
const MESSAGES: Record<number, { uz: string; ru: string; en: string }> = {
  [ERR.INVALID_AMOUNT]: {
    uz: "Toʻlov summasi notoʻgʻri",
    ru: "Неверная сумма платежа",
    en: "Invalid payment amount",
  },
  [ERR.TRANSACTION_NOT_FOUND]: {
    uz: "Tranzaksiya topilmadi",
    ru: "Транзакция не найдена",
    en: "Transaction not found",
  },
  [ERR.CANNOT_CANCEL]: {
    uz: "Buyurtma bajarilgan, tranzaksiyani bekor qilib boʻlmaydi",
    ru: "Заказ выполнен, отменить транзакцию невозможно",
    en: "The order is complete; the transaction cannot be cancelled",
  },
  [ERR.CANNOT_PERFORM]: {
    uz: "Bu amalni bajarib boʻlmaydi",
    ru: "Невозможно выполнить данную операцию",
    en: "This operation cannot be performed",
  },
  [ERR.ORDER_NOT_FOUND]: {
    uz: "Buyurtma topilmadi",
    ru: "Заказ не найден",
    en: "Order not found",
  },
  [ERR.ORDER_NOT_PAYABLE]: {
    uz: "Buyurtma allaqachon toʻlangan yoki bekor qilingan",
    ru: "Заказ уже оплачен или отменён",
    en: "The order has already been paid or cancelled",
  },
  [ERR.ORDER_BUSY]: {
    uz: "Bu buyurtma boʻyicha boshqa toʻlov kutilmoqda",
    ru: "По этому заказу уже ожидается другой платёж",
    en: "Another payment for this order is already in progress",
  },
  [ERR.INSUFFICIENT_PRIVILEGE]: {
    uz: "Ruxsat yoʻq",
    ru: "Недостаточно привилегий",
    en: "Insufficient privilege",
  },
  [ERR.INVALID_REQUEST]: {
    uz: "Notoʻgʻri soʻrov",
    ru: "Неверный запрос",
    en: "Invalid request",
  },
  [ERR.METHOD_NOT_FOUND]: {
    uz: "Usul topilmadi",
    ru: "Метод не найден",
    en: "Method not found",
  },
  [ERR.PARSE_ERROR]: {
    uz: "Soʻrovni oʻqib boʻlmadi",
    ru: "Ошибка разбора запроса",
    en: "Parse error",
  },
};

const STATE = { CREATED: 1, PERFORMED: 2, CANCELLED: -1, CANCELLED_AFTER: -2 } as const;

/** Payme's own reason code for "cancelled because it timed out". */
const REASON_TIMEOUT = 4;

/** A created transaction that is not performed within 12h is dead. */
const TRANSACTION_TIMEOUT_MS = 43_200_000;

const PRODUCTION_CHECKOUT = "https://checkout.paycom.uz";

export function isPaymeConfigured(): boolean {
  return Boolean(env.PAYME_MERCHANT_ID && env.PAYME_KEY);
}

/**
 * The hosted checkout link: base64 of `m=…;ac.order_id=…;a=…;l=…;c=…`.
 *
 * `PAYME_CHECKOUT_URL` switches it to the sandbox for testing, so the same
 * code runs against test and production with only configuration changing.
 */
export function paymeCheckoutUrl(
  paymentId: string,
  amountTiyin: number,
  returnUrl: string,
  lang: "uz" | "ru" | "en" = "uz",
) {
  const raw = [
    `m=${env.PAYME_MERCHANT_ID}`,
    `ac.order_id=${paymentId}`,
    `a=${amountTiyin}`,
    `l=${lang}`,
    `c=${returnUrl}`,
  ].join(";");
  const base = (env.PAYME_CHECKOUT_URL ?? PRODUCTION_CHECKOUT).replace(/\/+$/, "");
  return `${base}/${Buffer.from(raw).toString("base64")}`;
}

type Params = Record<string, unknown>;
type RpcId = string | number | null;

function ok(id: RpcId, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function fail(id: RpcId, code: number, data?: string) {
  return Response.json({
    jsonrpc: "2.0",
    id,
    error: { code, message: MESSAGES[code] ?? MESSAGES[ERR.CANNOT_PERFORM], data },
  });
}

/**
 * Basic auth: login must be `Paycom`, password must be the merchant key.
 * Compared in constant time so a timing difference cannot leak the key.
 */
function authOk(request: Request): boolean {
  const key = env.PAYME_KEY;
  if (!key) return false;
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const expected = Buffer.from(`Paycom:${key}`);
  const got = Buffer.from(decoded);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

function orderIdOf(params: Params): string | null {
  const account = params.account as Params | undefined;
  const v = account?.order_id;
  // Our order ids are UUIDs; anything else cannot match a row, and must not
  // reach Postgres as a malformed uuid literal.
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

function isTimedOut(meta: PaymeMeta, now: number): boolean {
  return meta.createTime != null && now - meta.createTime > TRANSACTION_TIMEOUT_MS;
}

export async function handlePaymeWebhook(request: Request): Promise<Response> {
  let body: { id?: RpcId; method?: unknown; params?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(null, ERR.PARSE_ERROR);
  }
  const id = body?.id ?? null;

  // Before anything is read: an unauthenticated caller learns nothing.
  if (!authOk(request)) return fail(id, ERR.INSUFFICIENT_PRIVILEGE);

  if (typeof body.method !== "string" || typeof body.params !== "object" || !body.params) {
    return fail(id, ERR.INVALID_REQUEST);
  }
  const params = body.params as Params;

  switch (body.method) {
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
      return getStatement(id, params);
    default:
      return fail(id, ERR.METHOD_NOT_FOUND);
  }
}

/**
 * The order and amount checks both CheckPerform and Create need. Returns the
 * payment when it can be paid, or the error response when it cannot.
 */
async function validateOrder(id: RpcId, params: Params) {
  const oid = orderIdOf(params);
  const payment = oid ? await paymentsRepository.findById(oid) : null;
  if (!payment || payment.provider !== "payme") {
    return { error: fail(id, ERR.ORDER_NOT_FOUND, "order_id") };
  }
  if (payment.status !== "pending") {
    return { error: fail(id, ERR.ORDER_NOT_PAYABLE, "order_id") };
  }
  if (Number(params.amount) !== payment.amountTiyin) {
    return { error: fail(id, ERR.INVALID_AMOUNT) };
  }
  return { payment };
}

async function checkPerform(id: RpcId, params: Params) {
  const v = await validateOrder(id, params);
  if (v.error) return v.error;
  const detail = await fiscalDetail(v.payment.courseId, v.payment.amountTiyin);
  return ok(id, detail ? { allow: true, detail } : { allow: true });
}

/**
 * The fiscal receipt Payme forwards to the tax system. Sent only when the
 * business has supplied its IKPU (MXIK) code, package code and VAT rate —
 * those are facts of its tax registration, and a guessed value on a receipt
 * would be worse than none.
 */
async function fiscalDetail(courseId: string, amountTiyin: number) {
  const code = env.PAYME_MXIK_CODE;
  const packageCode = env.PAYME_PACKAGE_CODE;
  const vat = env.PAYME_VAT_PERCENT;
  if (!code || !packageCode || vat == null || vat === "") return null;
  const course = await coursesRepository.findById(courseId);
  return {
    receipt_type: 0,
    items: [
      {
        title: course ? pickLocale(course.title, "uz") : "Kurs",
        price: amountTiyin,
        count: 1,
        code,
        package_code: packageCode,
        vat_percent: Number(vat),
      },
    ],
  };
}

async function createTransaction(id: RpcId, params: Params) {
  const paymeId = typeof params.id === "string" ? params.id : null;
  if (!paymeId) return fail(id, ERR.INVALID_REQUEST);
  const now = Date.now();

  // ── Transaction already known: answer from what we stored. ─────────────
  const existing = await paymentsRepository.findByIdempotencyKey(`payme:${paymeId}`);
  if (existing) {
    const meta = readPaymeMeta(existing.rawCallback);
    if (meta.state !== STATE.CREATED) return fail(id, ERR.CANNOT_PERFORM);
    if (isTimedOut(meta, now)) {
      await expire(existing.id, existing.rawCallback, meta, now);
      return fail(id, ERR.CANNOT_PERFORM);
    }
    return ok(id, {
      create_time: meta.createTime,
      transaction: existing.id,
      state: STATE.CREATED,
    });
  }

  // ── New transaction: the order must be payable, and not already taken. ──
  const v = await validateOrder(id, params);
  if (v.error) return v.error;
  const payment = v.payment;

  const owner = readPaymeMeta(payment.rawCallback);
  if (owner.paymeTransactionId && owner.paymeTransactionId !== paymeId) {
    if (owner.state === STATE.CREATED && !isTimedOut(owner, now)) {
      // One order, one live transaction: a second payer must not be charged.
      return fail(id, ERR.ORDER_BUSY, "order_id");
    }
  }

  await paymentsRepository.update(payment.id, {
    providerTxnId: paymeId,
    idempotencyKey: `payme:${paymeId}`,
    rawCallback: buildPaymeRaw(payment.rawCallback, {
      paymeTransactionId: paymeId,
      state: STATE.CREATED,
      createTime: now,
      paymeTime: Number(params.time) || now,
      performTime: undefined,
      cancelTime: undefined,
      reason: null,
    }),
  });
  return ok(id, { create_time: now, transaction: payment.id, state: STATE.CREATED });
}

async function performTransaction(id: RpcId, params: Params) {
  const paymeId = typeof params.id === "string" ? params.id : null;
  const payment = paymeId
    ? await paymentsRepository.findByIdempotencyKey(`payme:${paymeId}`)
    : null;
  if (!payment || !paymeId) return fail(id, ERR.TRANSACTION_NOT_FOUND);

  const meta = readPaymeMeta(payment.rawCallback);
  const now = Date.now();

  // Performed already: the same answer again, and no second enrollment.
  if (meta.state === STATE.PERFORMED) {
    return ok(id, {
      transaction: payment.id,
      perform_time: meta.performTime,
      state: STATE.PERFORMED,
    });
  }
  if (meta.state !== STATE.CREATED) return fail(id, ERR.CANNOT_PERFORM);

  if (isTimedOut(meta, now)) {
    await expire(payment.id, payment.rawCallback, meta, now);
    return fail(id, ERR.CANNOT_PERFORM);
  }

  await markPaidAndEnroll(payment.id, {
    providerTxnId: paymeId,
    idempotencyKey: `payme:${paymeId}`,
    raw: buildPaymeRaw(payment.rawCallback, { ...meta, state: STATE.PERFORMED, performTime: now }),
  });
  return ok(id, { transaction: payment.id, perform_time: now, state: STATE.PERFORMED });
}

async function cancelTransaction(id: RpcId, params: Params) {
  const paymeId = typeof params.id === "string" ? params.id : null;
  const payment = paymeId
    ? await paymentsRepository.findByIdempotencyKey(`payme:${paymeId}`)
    : null;
  if (!payment) return fail(id, ERR.TRANSACTION_NOT_FOUND);

  const meta = readPaymeMeta(payment.rawCallback);
  const reason = Number(params.reason) || null;

  // Cancelled already: report the cancellation we recorded.
  if (meta.state === STATE.CANCELLED || meta.state === STATE.CANCELLED_AFTER) {
    return ok(id, { transaction: payment.id, cancel_time: meta.cancelTime, state: meta.state });
  }

  const now = Date.now();

  if (meta.state === STATE.CREATED) {
    // Never performed, so nothing was granted: just release the order.
    await paymentsRepository.update(payment.id, {
      status: "failed",
      rawCallback: buildPaymeRaw(payment.rawCallback, {
        ...meta,
        state: STATE.CANCELLED,
        cancelTime: now,
        reason,
      }),
    });
    return ok(id, { transaction: payment.id, cancel_time: now, state: STATE.CANCELLED });
  }

  if (meta.state === STATE.PERFORMED) {
    // A refund. Allowed: the money goes back and the access it bought goes
    // with it (markCancelled revokes the enrollment and audits it).
    await markCancelled(payment.id, {
      reason,
      raw: buildPaymeRaw(payment.rawCallback, {
        ...meta,
        state: STATE.CANCELLED_AFTER,
        cancelTime: now,
        reason,
      }),
    });
    return ok(id, {
      transaction: payment.id,
      cancel_time: now,
      state: STATE.CANCELLED_AFTER,
    });
  }

  return fail(id, ERR.CANNOT_CANCEL);
}

async function checkTransaction(id: RpcId, params: Params) {
  const paymeId = typeof params.id === "string" ? params.id : null;
  const payment = paymeId
    ? await paymentsRepository.findByIdempotencyKey(`payme:${paymeId}`)
    : null;
  if (!payment) return fail(id, ERR.TRANSACTION_NOT_FOUND);

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

/** Every transaction CreateTransaction accepted in [from, to], oldest first. */
async function getStatement(id: RpcId, params: Params) {
  const from = Number(params.from);
  const to = Number(params.to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return fail(id, ERR.INVALID_REQUEST);

  const rows = await paymentsRepository.listPaymeCreatedBetween(from, to);
  const transactions = rows.map((p) => {
    const meta = readPaymeMeta(p.rawCallback);
    return {
      id: meta.paymeTransactionId,
      time: meta.paymeTime ?? meta.createTime,
      amount: p.amountTiyin,
      account: { order_id: p.id },
      create_time: meta.createTime ?? 0,
      perform_time: meta.performTime ?? 0,
      cancel_time: meta.cancelTime ?? 0,
      transaction: p.id,
      state: meta.state ?? STATE.CREATED,
      reason: meta.reason ?? null,
      receivers: null,
    };
  });
  return ok(id, { transactions });
}

/** Cancel a created transaction that outlived Payme's 12-hour window. */
async function expire(paymentId: string, raw: unknown, meta: PaymeMeta, now: number) {
  await paymentsRepository.update(paymentId, {
    status: "failed",
    rawCallback: buildPaymeRaw(raw, {
      ...meta,
      state: STATE.CANCELLED,
      cancelTime: now,
      reason: REASON_TIMEOUT,
    }),
  });
}

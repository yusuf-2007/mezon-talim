import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { IDS, PASSWORD, USERS, testSql } from "./db";
import { login } from "./helpers";
import uz from "../../messages/uz.json";

/**
 * The money path. Every assertion here is a variant of one rule: an enrolment
 * exists only after a verified provider callback says the money moved. Not
 * after checkout starts, not after Prepare, not after a callback with a bad
 * signature or the wrong amount — and a second callback never makes a second
 * enrolment.
 */

const CLICK_SERVICE_ID = "12345";
const CLICK_SECRET = "e2e-click-secret";
const PAYME_KEY = "e2e-payme-key";
const PRICE_TIYIN = 5_000_000; // 50 000 so'm

async function resetMoney() {
  const sql = testSql();
  const [u] = await sql`select id from users where email = ${USERS.studentB.email}`;
  await sql`update courses set price_tiyin = ${PRICE_TIYIN} where id = ${IDS.course}`;
  await sql`delete from enrollments where user_id = ${u.id}`;
  await sql`delete from payments where user_id = ${u.id}`;
  await sql`delete from rate_limits`;
  await sql.end();
  return u.id as string;
}

async function pendingPayment(userId: string, provider: "click" | "payme") {
  const sql = testSql();
  const [p] = await sql`
    insert into payments (user_id, course_id, provider, amount_tiyin, status)
    values (${userId}, ${IDS.course}, ${provider}, ${PRICE_TIYIN}, 'pending') returning id`;
  await sql.end();
  return p.id as string;
}

async function state(userId: string, paymentId: string) {
  const sql = testSql();
  const [{ n }] = await sql`
    select count(*)::int as n from enrollments where user_id = ${userId} and course_id = ${IDS.course}`;
  const [p] = await sql`select status from payments where id = ${paymentId}`;
  await sql.end();
  return { enrollments: n as number, payment: p.status as string };
}

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

/** Click's sign_string: Prepare omits merchant_prepare_id, Complete includes it. */
function clickForm(o: {
  transId: string; paymentId: string; amountSom: string; action: "0" | "1";
  prepareId?: string; secret?: string; error?: string;
}) {
  const secret = o.secret ?? CLICK_SECRET;
  const signTime = "2026-09-17 12:00:00";
  const base =
    o.action === "1"
      ? o.transId + CLICK_SERVICE_ID + secret + o.paymentId + (o.prepareId ?? "") + o.amountSom + o.action + signTime
      : o.transId + CLICK_SERVICE_ID + secret + o.paymentId + o.amountSom + o.action + signTime;
  return {
    click_trans_id: o.transId,
    service_id: CLICK_SERVICE_ID,
    merchant_trans_id: o.paymentId,
    ...(o.prepareId ? { merchant_prepare_id: o.prepareId } : {}),
    amount: o.amountSom,
    action: o.action,
    ...(o.error ? { error: o.error } : {}),
    sign_time: signTime,
    sign_string: md5(base),
  };
}

test.describe("checkout", () => {
  test("a priced course offers real checkout, never the free button", async ({ page }) => {
    await resetMoney();
    await login(page, USERS.studentB.email, PASSWORD);
    await page.goto("/uz/courses/e2e-course");
    await expect(page.getByRole("button", { name: /Click/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Payme/ })).toBeVisible();
    // The development free-enrol must not exist when a provider is configured.
    await expect(page.getByRole("button", { name: uz.Course.enrollDev, exact: true })).toHaveCount(0);
  });
});

test.describe("Click callbacks", () => {
  test("prepare, then a verified complete, enrols exactly once", async ({ request }) => {
    const userId = await resetMoney();
    const paymentId = await pendingPayment(userId, "click");
    const amountSom = String(PRICE_TIYIN / 100);

    const prepare = await request.post("/api/webhooks/click", {
      form: clickForm({ transId: "T1", paymentId, amountSom, action: "0" }),
    });
    expect((await prepare.json()).error).toBe(0);
    expect(await state(userId, paymentId)).toEqual({ enrollments: 0, payment: "pending" });

    const complete = await request.post("/api/webhooks/click", {
      form: clickForm({ transId: "T1", paymentId, amountSom, action: "1", prepareId: paymentId }),
    });
    expect((await complete.json()).error).toBe(0);
    expect(await state(userId, paymentId)).toEqual({ enrollments: 1, payment: "paid" });

    // Retried callback: acknowledged as already paid, no second enrolment.
    const again = await request.post("/api/webhooks/click", {
      form: clickForm({ transId: "T1", paymentId, amountSom, action: "1", prepareId: paymentId }),
    });
    expect((await again.json()).error).toBe(-4);
    expect((await state(userId, paymentId)).enrollments).toBe(1);
  });

  test("a bad signature enrols nobody", async ({ request }) => {
    const userId = await resetMoney();
    const paymentId = await pendingPayment(userId, "click");
    const res = await request.post("/api/webhooks/click", {
      form: clickForm({ transId: "T2", paymentId, amountSom: "50000", action: "1", prepareId: paymentId, secret: "wrong" }),
    });
    expect((await res.json()).error).toBe(-1);
    expect(await state(userId, paymentId)).toEqual({ enrollments: 0, payment: "pending" });
  });

  test("a correctly signed callback for the wrong amount enrols nobody", async ({ request }) => {
    const userId = await resetMoney();
    const paymentId = await pendingPayment(userId, "click");
    const res = await request.post("/api/webhooks/click", {
      form: clickForm({ transId: "T3", paymentId, amountSom: "1", action: "1", prepareId: paymentId }),
    });
    expect((await res.json()).error).toBe(-2);
    expect(await state(userId, paymentId)).toEqual({ enrollments: 0, payment: "pending" });
  });

  test("a provider-reported failure cancels the order", async ({ request }) => {
    const userId = await resetMoney();
    const paymentId = await pendingPayment(userId, "click");
    const res = await request.post("/api/webhooks/click", {
      form: clickForm({ transId: "T4", paymentId, amountSom: "50000", action: "1", prepareId: paymentId, error: "-5017" }),
    });
    expect((await res.json()).error).toBe(-9);
    expect(await state(userId, paymentId)).toEqual({ enrollments: 0, payment: "failed" });
  });
});

test.describe("Payme JSON-RPC", () => {
  const auth = { authorization: `Basic ${Buffer.from(`Paycom:${PAYME_KEY}`).toString("base64")}` };
  const rpc = (method: string, params: Record<string, unknown>) => ({
    jsonrpc: "2.0", id: 1, method, params,
  });

  test("create then perform enrols exactly once; perform is idempotent", async ({ request }) => {
    const userId = await resetMoney();
    const paymentId = await pendingPayment(userId, "payme");
    const account = { order_id: paymentId };

    const check = await request.post("/api/webhooks/payme", {
      headers: auth, data: rpc("CheckPerformTransaction", { amount: PRICE_TIYIN, account }),
    });
    expect((await check.json()).result.allow).toBe(true);

    const create = await request.post("/api/webhooks/payme", {
      headers: auth,
      data: rpc("CreateTransaction", { id: "PM-1", time: Date.now(), amount: PRICE_TIYIN, account }),
    });
    expect((await create.json()).result.state).toBe(1);
    expect(await state(userId, paymentId)).toEqual({ enrollments: 0, payment: "pending" });

    const perform = await request.post("/api/webhooks/payme", {
      headers: auth, data: rpc("PerformTransaction", { id: "PM-1" }),
    });
    expect((await perform.json()).result.state).toBe(2);
    expect(await state(userId, paymentId)).toEqual({ enrollments: 1, payment: "paid" });

    const again = await request.post("/api/webhooks/payme", {
      headers: auth, data: rpc("PerformTransaction", { id: "PM-1" }),
    });
    expect((await again.json()).result.state).toBe(2);
    expect((await state(userId, paymentId)).enrollments).toBe(1);
  });

  test("wrong credentials are refused before anything is read", async ({ request }) => {
    const userId = await resetMoney();
    const paymentId = await pendingPayment(userId, "payme");
    const res = await request.post("/api/webhooks/payme", {
      headers: { authorization: `Basic ${Buffer.from("Paycom:nope").toString("base64")}` },
      data: rpc("PerformTransaction", { id: "PM-2" }),
    });
    expect((await res.json()).error.code).toBe(-32504);
    expect(await state(userId, paymentId)).toEqual({ enrollments: 0, payment: "pending" });
  });

  test("the wrong amount is refused at create", async ({ request }) => {
    const userId = await resetMoney();
    const paymentId = await pendingPayment(userId, "payme");
    const res = await request.post("/api/webhooks/payme", {
      headers: auth,
      data: rpc("CreateTransaction", { id: "PM-3", time: Date.now(), amount: 100, account: { order_id: paymentId } }),
    });
    expect((await res.json()).error.code).toBe(-31001);
    expect((await state(userId, paymentId)).enrollments).toBe(0);
  });
});

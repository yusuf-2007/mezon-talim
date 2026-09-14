import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { USERS, testSql } from "./db";

/**
 * Delivery reporting.
 *
 * The point of these endpoints is that `sent` stops meaning "probably fine":
 * Eskiz returns a queued id and the operator can still drop the message, and
 * Resend accepts mail that later bounces. Both outcomes arrive only by webhook,
 * so what is tested here is that a report moves the row — and, just as
 * importantly, that an unauthenticated one does not.
 */

const WEBHOOK_SECRET = "whsec_bWV6b24tZTJlLXRlc3Qtc2VjcmV0";

async function seedNotification(opts: {
  channel: "sms" | "email";
  providerMessageId?: string;
}): Promise<string> {
  const sql = testSql();
  const [user] = await sql`select id from users where email = ${USERS.studentA.email}`;
  const [row] = await sql`
    insert into notifications (user_id, channel, type, status, provider_message_id, sent_at)
    values (${user.id}, ${opts.channel}, ${"test_delivery"}, 'sent',
            ${opts.providerMessageId ?? null}, now())
    returning id`;
  await sql.end();
  return row.id;
}

async function statusOf(id: string) {
  const sql = testSql();
  const [row] = await sql`
    select status, provider_status, delivered_at from notifications where id = ${id}`;
  await sql.end();
  return row;
}

/** The same HMAC the app puts in each Eskiz callback URL. */
function callbackToken(notificationId: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET!)
    .update(notificationId)
    .digest("base64url");
}

function svixHeaders(body: string) {
  const id = "msg_e2e";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const key = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ""), "base64");
  const signature = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${signature}`,
    "content-type": "application/json",
  };
}

test.describe("SMS delivery reports", () => {
  test("a DELIVRD report marks the row delivered", async ({ request }) => {
    const id = await seedNotification({ channel: "sms" });
    const res = await request.post(
      `/api/webhooks/eskiz?n=${id}&t=${encodeURIComponent(callbackToken(id))}`,
      { form: { status: "DELIVRD" } },
    );
    expect(res.status()).toBe(200);

    const row = await statusOf(id);
    expect(row.status).toBe("delivered");
    expect(row.provider_status).toBe("DELIVRD");
    expect(row.delivered_at).not.toBeNull();
  });

  test("a REJECTD report marks the row rejected", async ({ request }) => {
    const id = await seedNotification({ channel: "sms" });
    await request.post(
      `/api/webhooks/eskiz?n=${id}&t=${encodeURIComponent(callbackToken(id))}`,
      { form: { status: "REJECTD" } },
    );
    const row = await statusOf(id);
    expect(row.status).toBe("rejected");
    expect(row.delivered_at).toBeNull();
  });

  test("a forged token cannot change a status", async ({ request }) => {
    const id = await seedNotification({ channel: "sms" });
    const res = await request.post(`/api/webhooks/eskiz?n=${id}&t=not-a-real-token`, {
      form: { status: "DELIVRD" },
    });
    // Answers 200 so the gateway stops retrying, but must not have touched it.
    expect(res.status()).toBe(200);
    expect((await statusOf(id)).status).toBe("sent");
  });

  test("a token for one message cannot rewrite another", async ({ request }) => {
    const mine = await seedNotification({ channel: "sms" });
    const theirs = await seedNotification({ channel: "sms" });
    await request.post(
      `/api/webhooks/eskiz?n=${theirs}&t=${encodeURIComponent(callbackToken(mine))}`,
      { form: { status: "DELIVRD" } },
    );
    expect((await statusOf(theirs)).status).toBe("sent");
  });

  test("a non-terminal state is ignored", async ({ request }) => {
    const id = await seedNotification({ channel: "sms" });
    await request.post(
      `/api/webhooks/eskiz?n=${id}&t=${encodeURIComponent(callbackToken(id))}`,
      { form: { status: "ACCEPTD" } },
    );
    expect((await statusOf(id)).status).toBe("sent");
  });

  test("a late rejection cannot undo a known delivery", async ({ request }) => {
    const id = await seedNotification({ channel: "sms" });
    const url = `/api/webhooks/eskiz?n=${id}&t=${encodeURIComponent(callbackToken(id))}`;
    await request.post(url, { form: { status: "DELIVRD" } });
    await request.post(url, { form: { status: "REJECTD" } });
    // Providers retry and reorder; a delivery we have confirmed stands.
    expect((await statusOf(id)).status).toBe("delivered");
  });
});

test.describe("email delivery events", () => {
  test("a signed bounce marks the row rejected", async ({ request }) => {
    const emailId = `e2e-${Date.now()}`;
    const id = await seedNotification({ channel: "email", providerMessageId: emailId });
    const body = JSON.stringify({
      type: "email.bounced",
      data: { email_id: emailId },
    });

    const res = await request.post("/api/webhooks/resend", {
      headers: svixHeaders(body),
      data: body,
    });
    expect(res.status()).toBe(200);
    expect((await statusOf(id)).status).toBe("rejected");
  });

  test("an unsigned event is refused", async ({ request }) => {
    const emailId = `e2e-unsigned-${Date.now()}`;
    const id = await seedNotification({ channel: "email", providerMessageId: emailId });
    const res = await request.post("/api/webhooks/resend", {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ type: "email.bounced", data: { email_id: emailId } }),
    });
    expect(res.status()).toBe(401);
    expect((await statusOf(id)).status).toBe("sent");
  });

  test("a validly signed body cannot be swapped for another", async ({ request }) => {
    const emailId = `e2e-tamper-${Date.now()}`;
    const id = await seedNotification({ channel: "email", providerMessageId: emailId });
    const signedBody = JSON.stringify({ type: "email.delivered", data: { email_id: "other" } });
    const tamperedBody = JSON.stringify({
      type: "email.bounced",
      data: { email_id: emailId },
    });

    // Headers signed for one payload, a different payload sent.
    const res = await request.post("/api/webhooks/resend", {
      headers: svixHeaders(signedBody),
      data: tamperedBody,
    });
    expect(res.status()).toBe(401);
    expect((await statusOf(id)).status).toBe("sent");
  });

  test("a complaint is recorded as delivered, with the reason kept", async ({
    request,
  }) => {
    const emailId = `e2e-spam-${Date.now()}`;
    const id = await seedNotification({ channel: "email", providerMessageId: emailId });
    const body = JSON.stringify({
      type: "email.complained",
      data: { email_id: emailId },
    });
    await request.post("/api/webhooks/resend", { headers: svixHeaders(body), data: body });

    // It did arrive; the recipient then marked it spam. Calling that a delivery
    // failure would misreport what happened.
    const row = await statusOf(id);
    expect(row.status).toBe("delivered");
    expect(row.provider_status).toBe("email.complained");
  });
});

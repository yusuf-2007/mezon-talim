import { createHmac, timingSafeEqual } from "node:crypto";
import { notificationsRepository } from "@/lib/db/repositories/notifications";
import { env } from "@/lib/env";

// Resend delivery events. Outside [locale]; excluded from the i18n proxy.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resend posts here when a message is delivered, bounces, or is complained
 * about. Signed with Svix, verified below rather than by pulling in the `svix`
 * package for one HMAC.
 *
 * Unlike the Eskiz callback there is no per-message URL to rely on, so the
 * signature is the whole of the authentication — an unverified body must never
 * reach the database, or anyone who learns the endpoint could mark arbitrary
 * mail as bounced.
 */

/** Reject anything older than this, so a captured request cannot be replayed. */
const TOLERANCE_MS = 5 * 60 * 1000;

type ResendEvent = {
  type?: string;
  data?: { email_id?: string };
};

export async function POST(request: Request) {
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET is not set");
    return new Response("not configured", { status: 503 });
  }

  const raw = await request.text();
  if (!isAuthentic(request, raw, secret)) {
    return new Response("invalid signature", { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(raw) as ResendEvent;
  } catch {
    return new Response("bad body", { status: 400 });
  }

  const emailId = event.data?.email_id;
  const type = event.type;
  if (!emailId || !type) return Response.json({ ok: true });

  // Only terminal outcomes are recorded. 'email.sent' repeats what we already
  // know, and delayed/opened/clicked say nothing about whether it arrived.
  //
  // A complaint is recorded as delivered on purpose: the message *did* reach
  // the inbox, and the recipient then marked it spam. Calling that a delivery
  // failure would misreport what happened — the raw event type is kept in
  // provider_status, which is where that signal belongs.
  const outcome =
    type === "email.delivered" || type === "email.complained"
      ? "delivered"
      : type === "email.bounced"
        ? "rejected"
        : null;
  if (!outcome) return Response.json({ ok: true });

  if (type === "email.complained") {
    console.warn(`[resend-webhook] spam complaint for email ${emailId}`);
  }

  const row = await notificationsRepository.findByProviderMessageId(emailId);
  if (!row) return Response.json({ ok: true });

  await notificationsRepository.recordDeliveryOutcome(row.id, outcome, type);
  return Response.json({ ok: true });
}

/**
 * Svix signature check: HMAC-SHA256 over `id.timestamp.body`, keyed by the
 * base64 payload of the `whsec_` secret. The header carries a space-separated
 * list of `v1,<sig>` pairs so a secret can be rotated without downtime, and any
 * one of them matching is enough.
 */
function isAuthentic(request: Request, body: string, secret: string): boolean {
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const header = request.headers.get("svix-signature");
  if (!id || !timestamp || !header) return false;

  const sentAt = Number(timestamp) * 1000;
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > TOLERANCE_MS) {
    return false;
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  return header
    .split(" ")
    .filter((part) => part.startsWith("v1,"))
    .some((part) => equals(part.slice(3), expected));
}

/** Length-tolerant constant-time compare; the caller controls the input. */
function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

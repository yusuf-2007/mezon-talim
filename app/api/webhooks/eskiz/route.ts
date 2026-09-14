import { notificationsRepository } from "@/lib/db/repositories/notifications";
import { deliveryCallbackIsValid } from "@/lib/notifications/callback";

// Eskiz delivery reports. Outside [locale]; excluded from the i18n proxy.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Eskiz posts here once the operator reports what became of a message.
 *
 * Eskiz does not sign its callbacks, so the only proof this report is about a
 * message we sent is the HMAC we put in the URL ourselves (see
 * lib/notifications/callback). The body is otherwise unauthenticated input and
 * is treated as such: nothing in it selects the row.
 *
 * Always answers 200. A gateway that reads a non-2xx as "retry" will keep
 * redelivering a report we have already rejected, and there is no failure here
 * worth a retry — an unverifiable report will not become verifiable later.
 */

/** SMPP delivery states, as Eskiz forwards them from the operator. */
const DELIVERED = new Set(["DELIVRD", "DELIVERED"]);
const DROPPED = new Set([
  "REJECTD",
  "REJECTED",
  "UNDELIV",
  "UNDELIVERABLE",
  "EXPIRED",
  "DELETED",
  "UNKNOWN",
  "FAILED",
]);

export async function POST(request: Request) {
  const url = new URL(request.url);
  const notificationId = url.searchParams.get("n");
  const token = url.searchParams.get("t");

  if (!notificationId || !token || !deliveryCallbackIsValid(notificationId, token)) {
    console.warn("[eskiz-callback] rejected an unverifiable delivery report");
    return Response.json({ ok: true });
  }

  const status = await readStatus(request);
  if (!status) return Response.json({ ok: true });

  const upper = status.toUpperCase();
  // ACCEPTD and other in-flight states are not outcomes; wait for a terminal one.
  const outcome = DELIVERED.has(upper)
    ? "delivered"
    : DROPPED.has(upper)
      ? "rejected"
      : null;
  if (!outcome) return Response.json({ ok: true });

  const applied = await notificationsRepository.recordDeliveryOutcome(
    notificationId,
    outcome,
    status,
  );
  if (!applied) {
    // Already terminal, or the row is gone. Both are fine and neither is ours
    // to fix — logged because a flood of these means duplicate callbacks.
    console.info(`[eskiz-callback] ${status} ignored for ${notificationId}`);
  }
  return Response.json({ ok: true });
}

/**
 * Eskiz has posted both form-encoded and JSON over the years, and the status
 * field has appeared as `status` and as `message_status`. Accept all of it
 * rather than silently dropping reports after a gateway-side change.
 */
async function readStatus(request: Request): Promise<string | null> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      const value = body.status ?? body.message_status ?? body.dlr_state;
      return typeof value === "string" ? value : null;
    }
    const form = await request.formData();
    const value =
      form.get("status") ?? form.get("message_status") ?? form.get("dlr_state");
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

import "server-only";
import { publicBaseUrl } from "@/lib/base-url";
import { signPayload, signatureMatches } from "@/lib/signing";

/**
 * Per-message delivery-report URL for providers that do not sign their
 * callbacks (Eskiz).
 *
 * Eskiz posts a delivery report to whatever `callback_url` the send specified,
 * with no signature and no shared secret — so anything listening on that route
 * has to prove for itself that the report is about a message we actually sent.
 * A single shared secret in the path would do it, but one leak (a proxy log, a
 * screenshot) would let anyone rewrite the delivery status of every
 * notification in the table.
 *
 * Instead each URL names one notification and carries an HMAC over that id. A
 * leaked URL is then worth exactly one row's status, and only the row it was
 * already about. It also means the webhook can find its row directly rather
 * than searching by a provider id it has to trust first.
 */

export function deliveryCallbackUrl(notificationId: string): string {
  const token = signPayload(notificationId);
  return `${publicBaseUrl()}/api/webhooks/eskiz?n=${encodeURIComponent(notificationId)}&t=${encodeURIComponent(token)}`;
}

export function deliveryCallbackIsValid(
  notificationId: string,
  token: string,
): boolean {
  return signatureMatches(notificationId, token);
}

import type { PaymentAdapter, PaymentProviderId } from "./types";

export type * from "./types";

/**
 * Payment adapters registry. Phase 5 implements the Click and Payme adapters
 * (webhook route handlers in /app/api/webhooks/*) and registers them here.
 */

const NOT_IMPLEMENTED =
  "lib/payments: adapters not implemented until Phase 5 (Click + Payme).";

export function getPaymentAdapter(provider: PaymentProviderId): PaymentAdapter {
  // TODO(phase-5): return the Click or Payme adapter.
  throw new Error(`${NOT_IMPLEMENTED} (requested: ${provider})`);
}

/** Integer-tiyin money formatter for display. Never used for arithmetic. */
export function formatTiyin(
  amountTiyin: number,
  locale: "uz" | "ru" = "uz",
): string {
  const som = amountTiyin / 100;
  const intlLocale = locale === "ru" ? "ru-UZ" : "uz-UZ";
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "UZS",
    maximumFractionDigits: 0,
  }).format(som);
}

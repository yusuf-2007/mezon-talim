import { isClickConfigured, clickCheckoutUrl } from "./click";
import { isPaymeConfigured, paymeCheckoutUrl } from "./payme";

export type * from "./types";
export type { PaymeMeta } from "./service";

export type PaymentProviderId = "click" | "payme";

/** Providers with credentials configured (others fall back to dev-enroll). */
export function enabledPaymentProviders(): PaymentProviderId[] {
  const out: PaymentProviderId[] = [];
  if (isClickConfigured()) out.push("click");
  if (isPaymeConfigured()) out.push("payme");
  return out;
}

export function isPaymentsConfigured(): boolean {
  return enabledPaymentProviders().length > 0;
}

/** Build the hosted-checkout URL for a provider. */
export function checkoutUrlFor(
  provider: PaymentProviderId,
  args: { paymentId: string; amountTiyin: number; returnUrl: string },
): string {
  if (provider === "click") {
    return clickCheckoutUrl(args.paymentId, args.amountTiyin / 100, args.returnUrl);
  }
  return paymeCheckoutUrl(args.paymentId, args.amountTiyin, args.returnUrl);
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

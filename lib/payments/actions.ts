"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { createPendingPayment } from "./service";
import { checkoutUrlFor, type PaymentProviderId } from "./index";
import { publicBaseUrl } from "@/lib/base-url";

/**
 * Begin a real checkout: create a pending payment, then redirect the buyer to
 * the provider's hosted checkout. Enrollment is NOT created here — it happens
 * only when the provider's verified callback hits the webhook (Click Complete /
 * Payme PerformTransaction).
 */
export async function startCheckoutAction(
  courseId: string,
  provider: PaymentProviderId,
): Promise<void> {
  const user = await requireUser();
  const locale = await getLocale();

  const { payment, course } = await createPendingPayment({
    userId: user.id,
    courseId,
    provider,
  });

  // publicBaseUrl, not AUTH_URL: AUTH_URL is unset in production, and the old
  // fallback sent a buyer back to http://localhost:3000 after paying.
  const returnUrl = `${publicBaseUrl()}/${locale}/courses/${course.slug}`;
  const checkoutUrl = checkoutUrlFor(provider, {
    paymentId: payment.id,
    amountTiyin: payment.amountTiyin,
    returnUrl,
    locale: locale as "uz" | "ru" | "en",
  });

  redirect(checkoutUrl); // external redirect to the provider
}

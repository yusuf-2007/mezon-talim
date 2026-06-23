"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { createPendingPayment } from "./service";
import { checkoutUrlFor, type PaymentProviderId } from "./index";

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

  const base = env.AUTH_URL ?? "http://localhost:3000";
  const returnUrl = `${base}/${locale}/courses/${course.slug}`;
  const checkoutUrl = checkoutUrlFor(provider, {
    paymentId: payment.id,
    amountTiyin: payment.amountTiyin,
    returnUrl,
  });

  redirect(checkoutUrl); // external redirect to the provider
}

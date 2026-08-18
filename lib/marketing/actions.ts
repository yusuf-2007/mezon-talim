"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { applicationsRepository } from "@/lib/db/repositories/applications";
import { checkRateLimit } from "@/lib/rate-limit";
import { applicationSchema } from "./schemas";

export type ApplicationFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

const MIN = 60_000;
/** Per-phone cap. Generous enough for a genuine retype, tight enough to blunt spam. */
const PHONE_LIMIT = { limit: 3, windowMs: 60 * MIN };
/** A phone that applied this recently is treated as an idempotent re-submit. */
const DEDUPE_HOURS = 24;

/**
 * Public, unauthenticated lead capture from the landing page. Not a purchase —
 * courses run in cohorts and the sale is consultative, so this only records an
 * application for the team to follow up (CLAUDE.md scope: payments stay on the
 * verified-callback path).
 */
export async function submitApplicationAction(
  _prev: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  const t = await getTranslations("Landing.form");

  const parsed = applicationSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    organization: formData.get("organization") ?? undefined,
    source: formData.get("source") ?? undefined,
    smsConsent: formData.get("smsConsent") === "on",
  });
  if (!parsed.success) {
    // zod's own messages are Uzbek-only (they live in lib/auth/schemas for the
    // auth flows), so re-map per field to the translated copy instead of
    // leaking a fixed-language string onto a three-locale page.
    const raw = z.flattenError(parsed.error).fieldErrors as Record<
      string,
      string[] | undefined
    >;
    const fieldErrors: Record<string, string[]> = {};
    if (raw.fullName?.length) fieldErrors.fullName = [t("errName")];
    if (raw.phone?.length) fieldErrors.phone = [t("errPhone")];
    if (raw.organization?.length) fieldErrors.organization = [t("errOrg")];
    return { fieldErrors };
  }

  const { ok } = await checkRateLimit(
    `application:${parsed.data.phone}`,
    PHONE_LIMIT.limit,
    PHONE_LIMIT.windowMs,
  );
  if (!ok) return { error: t("tooMany") };

  try {
    // A repeat submit from the same phone inside the window is almost always a
    // double-click or an impatient retry — report success rather than stacking
    // duplicate leads on the follow-up queue.
    if (await applicationsRepository.hasRecent(parsed.data.phone, DEDUPE_HOURS)) {
      return { ok: true };
    }

    await applicationsRepository.create({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      organization: parsed.data.organization ?? null,
      source: parsed.data.source,
      locale: await getLocale(),
      smsConsent: parsed.data.smsConsent,
    });
    return { ok: true };
  } catch (err) {
    console.error("[marketing] application submit failed:", err);
    return { error: t("failed") };
  }
}

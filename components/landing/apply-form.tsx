"use client";

import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import {
  submitApplicationAction,
  type ApplicationFormState,
} from "@/lib/marketing/actions";
import { TelegramIcon } from "./icons";

const INITIAL: ApplicationFormState = {};

/**
 * The landing page's primary conversion: a lead, not a purchase. Courses run in
 * cohorts and the sale is consultative, so this collects name / phone / employer
 * and hands off to a callback.
 *
 * The SMS-consent checkbox is a contractual requirement, not a nicety — Eskiz
 * contract 1830-2026 §4.1.8 obliges Mezon to obtain *and register* consent
 * before sending, with a 30 BRV penalty under §5.5 otherwise. Left unticked the
 * lead is still saved; it just may only be phoned.
 */
export function ApplyForm() {
  const t = useTranslations("Landing.form");
  const [state, formAction, pending] = useActionState(
    submitApplicationAction,
    INITIAL,
  );
  // Controlled on purpose: React resets a <form action={...}> after every
  // submit, so with uncontrolled inputs one bad phone number would also wipe
  // the name and workplace the visitor already typed.
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const nameId = "lp-apply-name";
  const phoneId = useId();
  const orgId = useId();
  const consentId = useId();
  const errorId = useId();

  if (state.ok) {
    return (
      <div className="rounded-[18px] border border-lp-line bg-white p-8 text-center shadow-[0_6px_24px_rgb(2_58_105/0.09)]">
        <span
          aria-hidden
          className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-lp-gold-tint"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-lp-gold-deep"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h3 className="font-lp-heading text-[1.4rem] font-semibold text-lp-navy">
          {t("successTitle")}
        </h3>
        <p className="mt-2 text-[0.95rem] leading-[1.6] text-lp-slate">
          {t("successBody")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[18px] border border-lp-line bg-white p-8 shadow-[0_6px_24px_rgb(2_58_105/0.09)]">
      <h3 className="mb-1.5 font-lp-heading text-[1.4rem] font-semibold text-lp-navy">
        {t("title")}
      </h3>
      <p className="mb-6 text-[0.92rem] text-lp-slate">{t("lead")}</p>

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor={nameId}
            className="mb-1.5 block text-[0.82rem] font-semibold text-lp-ink"
          >
            {t("name")}
          </label>
          <input
            id={nameId}
            name="fullName"
            type="text"
            autoComplete="name"
            required
            maxLength={120}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("namePlaceholder")}
            aria-invalid={Boolean(state.fieldErrors?.fullName)}
            className="lp-fld"
          />
          <FieldError messages={state.fieldErrors?.fullName} />
        </div>

        <div>
          <label
            htmlFor={phoneId}
            className="mb-1.5 block text-[0.82rem] font-semibold text-lp-ink"
          >
            {t("phone")}
          </label>
          <input
            id={phoneId}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("phonePlaceholder")}
            aria-invalid={Boolean(state.fieldErrors?.phone)}
            className="lp-fld"
          />
          <FieldError messages={state.fieldErrors?.phone} />
        </div>

        <div>
          <label
            htmlFor={orgId}
            className="mb-1.5 block text-[0.82rem] font-semibold text-lp-ink"
          >
            {t("org")}{" "}
            <span className="font-medium text-lp-muted">{t("orgOptional")}</span>
          </label>
          <input
            id={orgId}
            name="organization"
            type="text"
            autoComplete="organization"
            maxLength={160}
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder={t("orgPlaceholder")}
            className="lp-fld"
          />
        </div>

        {/* Consent reads as part of the form rather than an afterthought: it
            sits on the wash ground with the same border language as the fields,
            and the whole row is the tap target. */}
        <label
          htmlFor={consentId}
          className="-mt-1 flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border border-lp-line bg-lp-wash px-3.5 py-2.5 text-[0.85rem] leading-[1.5] text-lp-slate transition-colors hover:border-lp-navy/30"
        >
          <input
            id={consentId}
            name="smsConsent"
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            className="h-[18px] w-[18px] shrink-0 rounded-[4px] accent-lp-navy"
          />
          <span>{t("consent")}</span>
        </label>

        {state.error && (
          <p
            id={errorId}
            role="alert"
            className="rounded-lg bg-danger/10 px-3 py-2 text-[0.85rem] text-danger"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          aria-describedby={state.error ? errorId : undefined}
          className="lp-gold mt-1 cursor-pointer rounded-[11px] bg-lp-gold p-[15px] text-base font-bold text-lp-navy-deep shadow-[0_6px_18px_rgb(248_184_1/0.3)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? t("submitting") : t("submit")}
        </button>

        <p className="text-center text-[0.8rem] leading-[1.5] text-lp-muted">
          {t("privacy")}
        </p>
      </form>

      <div className="mt-[22px] border-t border-lp-line-soft pt-[22px] text-center">
        <p className="mb-3 text-[0.9rem] text-lp-slate">{t("notRushing")}</p>
        {/* No Telegram URL yet (PRODUCT.md, Evidence on Hand). Rendered inert
            rather than as href="#", which would jump to the top of the page. */}
        <span className="inline-flex min-h-11 items-center gap-2.5 rounded-[10px] border border-dashed border-lp-line bg-lp-wash px-[18px] py-[11px] text-[0.9rem] font-semibold text-lp-muted">
          <TelegramIcon />
          {t("telegram")}
        </span>
      </div>
    </div>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="mt-1.5 text-[0.8rem] text-danger">
      {messages[0]}
    </p>
  );
}

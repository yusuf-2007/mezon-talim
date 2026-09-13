"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import {
  completePhoneSignupAction,
  loginAction,
  sendPhoneCodeAction,
  signUpAction,
  verifyPhoneCodeAction,
  type AuthFormState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "./form-bits";

const initial: AuthFormState = {};

const OCCUPATIONS = [
  "student",
  "business_owner",
  "corporate_employee",
  "educator",
  "other",
] as const;

/** Which credential the visitor is using. Phone is the default in UZ. */
type Mode = "phone" | "email-login" | "email-signup";

/** How far along the phone flow is. The server decides every transition. */
type Stage = "phone" | "code" | "profile";

/**
 * The single entry point for signing in and signing up.
 *
 * Sign-in and sign-up are not separate flows here, because with a phone number
 * they cannot be: whether a number belongs to an account is only knowable after
 * its code is checked, and asking someone to declare up front which one they
 * are just invites them to pick wrong. So one number goes in, and the server
 * routes to "welcome back" or "tell us your name" once it knows.
 *
 * Email + password stays available behind a link for anyone who prefers it, or
 * who is abroad where an Uzbek SMS may not arrive.
 */
export function AuthEntry({ otpEnabled }: { otpEnabled: boolean }) {
  const t = useTranslations("Auth");
  // With SMS unavailable there is nothing to default to, so the email form is
  // the whole screen rather than a link under a dead phone field.
  const [mode, setMode] = useState<Mode>(otpEnabled ? "phone" : "email-login");

  return (
    <div className="space-y-6">
      {mode === "phone" && <PhonePanel onUseEmail={() => setMode("email-login")} />}

      {mode === "email-login" && (
        <EmailLoginPanel
          otpEnabled={otpEnabled}
          onUsePhone={() => setMode("phone")}
          onSignup={() => setMode("email-signup")}
        />
      )}

      {mode === "email-signup" && (
        <EmailSignupPanel
          otpEnabled={otpEnabled}
          onUsePhone={() => setMode("phone")}
          onLogin={() => setMode("email-login")}
        />
      )}

      {!otpEnabled && mode !== "phone" && (
        <p className="text-center text-xs text-slate-500">{t("otpDisabled")}</p>
      )}
    </div>
  );
}

// ── Phone ───────────────────────────────────────────────────────────────────

function PhonePanel({ onUseEmail }: { onUseEmail: () => void }) {
  const t = useTranslations("Auth");
  const tAud = useTranslations("Audience");

  const [sendState, sendAction, sending] = useActionState(sendPhoneCodeAction, initial);
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyPhoneCodeAction,
    initial,
  );
  const [profileState, profileAction, savingProfile] = useActionState(
    completePhoneSignupAction,
    initial,
  );

  /**
   * The result the student has chosen to leave behind by tapping "change
   * number". Every other transition is already described by the action states,
   * so the only thing worth storing is the one move the server has no opinion
   * about: going back. Holding the dismissed state object (rather than a
   * boolean) means the next send — a new object — automatically un-dismisses.
   */
  const [dismissed, setDismissed] = useState<AuthFormState | null>(null);

  const stage: Stage =
    verifyState.step === "profile"
      ? "profile"
      : sendState.step === "code" && sendState !== dismissed
        ? "code"
        : "phone";

  const phone = sendState.phone ?? verifyState.phone ?? "";

  if (stage === "profile") {
    return (
      <div className="space-y-4">
        <PanelHeader title={t("profileTitle")} subtitle={t("profileSubtitle")} />

        <form action={profileAction} className="space-y-4">
          <FormError message={profileState.error} />
          <div>
            <Label htmlFor="fullName" className="mb-1.5">{t("fullName")}</Label>
            <Input id="fullName" name="fullName" autoComplete="name" required autoFocus />
            <FieldError errors={profileState.fieldErrors?.fullName} />
          </div>
          <div>
            <Label htmlFor="occupation" className="mb-1.5">{tAud("fieldLabel")}</Label>
            <select
              id="occupation"
              name="occupation"
              defaultValue=""
              className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink"
            >
              <option value="">{tAud("fieldPlaceholder")}</option>
              {OCCUPATIONS.map((o) => (
                <option key={o} value={o}>
                  {tAud(`occ_${o}`)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={savingProfile}>
            {t("createAccount")}
          </Button>
        </form>
      </div>
    );
  }

  if (stage === "code") {
    return (
      <div className="space-y-4">
        <PanelHeader
          title={t("codeTitle")}
          subtitle={t("codeSentTo", { phone: formatPhone(phone) })}
        />

        <CodeForm
          phone={phone}
          action={verifyAction}
          pending={verifying}
          state={verifyState}
        />

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setDismissed(sendState)}
            className="text-navy-600 hover:underline"
          >
            {t("changeNumber")}
          </button>
          {/* A second form so resending does not carry the code field along. */}
          <form action={sendAction}>
            <input type="hidden" name="phone" value={phone} />
            <button
              type="submit"
              disabled={sending}
              className="text-navy-600 hover:underline disabled:opacity-50"
            >
              {t("resendCode")}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PanelHeader title={t("entryTitle")} subtitle={t("entrySubtitle")} />

      <form action={sendAction} className="space-y-4">
        <FormError message={sendState.error} />
        <div>
          <Label htmlFor="phone" className="mb-1.5">{t("phone")}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t("phonePlaceholder")}
            defaultValue={phone}
            required
            autoFocus
          />
          <FieldError errors={sendState.fieldErrors?.phone} />
          <p className="mt-1 text-xs text-slate-500">{t("phoneHint")}</p>
        </div>
        <Button type="submit" className="w-full" disabled={sending}>
          {t("sendOtp")}
        </Button>
      </form>

      <Divider label={t("orDivider")} />

      <button
        type="button"
        onClick={onUseEmail}
        className="w-full text-center text-sm font-medium text-navy-600 hover:underline"
      >
        {t("useEmail")}
      </button>
    </div>
  );
}

/**
 * The code field, split out so it can own the auto-submit.
 *
 * Four digits is short enough that hunting for a button after typing the last
 * one is the slowest part of the whole flow, and on a phone the keypad is
 * covering that button anyway.
 */
function CodeForm({
  phone,
  action,
  pending,
  state,
}: {
  phone: string;
  action: (formData: FormData) => void;
  pending: boolean;
  state: AuthFormState;
}) {
  const t = useTranslations("Auth");
  const formRef = useRef<HTMLFormElement>(null);
  const submittedFor = useRef<string | null>(null);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <FormError message={state.error} />
      <input type="hidden" name="phone" value={phone} />
      <div>
        <Label htmlFor="code" className="sr-only">
          {t("code")}
        </Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          pattern="[0-9]{4}"
          required
          autoFocus
          className="text-center text-lg tracking-[0.5em]"
          onChange={(e) => {
            const value = e.target.value;
            // Guard against submitting the same code twice: a wrong code leaves
            // four digits in the field, and any further keystroke would fire
            // again on a value the server has already rejected.
            if (value.length === 4 && submittedFor.current !== value) {
              submittedFor.current = value;
              formRef.current?.requestSubmit();
            }
          }}
        />
        <FieldError errors={state.fieldErrors?.code} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {t("verifyOtp")}
      </Button>
    </form>
  );
}

// ── Email ───────────────────────────────────────────────────────────────────

function EmailLoginPanel({
  otpEnabled,
  onUsePhone,
  onSignup,
}: {
  otpEnabled: boolean;
  onUsePhone: () => void;
  onSignup: () => void;
}) {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <div className="space-y-4">
      <PanelHeader title={t("emailLoginTitle")} subtitle={t("loginSubtitle")} />

      <form action={action} className="space-y-4">
        <FormError message={state.error} />
        <div>
          <Label htmlFor="email" className="mb-1.5">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          <FieldError errors={state.fieldErrors?.email} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password">{t("password")}</Label>
            <Link href="/reset" className="text-sm text-navy-600 hover:underline">
              {t("forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <FieldError errors={state.fieldErrors?.password} />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {t("submitLogin")}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500">
        {t("needEmailAccount")}{" "}
        <button
          type="button"
          onClick={onSignup}
          className="font-medium text-navy-600 hover:underline"
        >
          {t("emailSignupLink")}
        </button>
      </p>

      {otpEnabled && (
        <>
          <Divider label={t("orDivider")} />
          <button
            type="button"
            onClick={onUsePhone}
            className="w-full text-center text-sm font-medium text-navy-600 hover:underline"
          >
            {t("usePhone")}
          </button>
        </>
      )}
    </div>
  );
}

function EmailSignupPanel({
  otpEnabled,
  onUsePhone,
  onLogin,
}: {
  otpEnabled: boolean;
  onUsePhone: () => void;
  onLogin: () => void;
}) {
  const t = useTranslations("Auth");
  const tAud = useTranslations("Audience");
  const [state, action, pending] = useActionState(signUpAction, initial);

  return (
    <div className="space-y-4">
      <PanelHeader
        title={t("emailSignupTitle")}
        subtitle={t("emailSignupSubtitle")}
      />

      <form action={action} className="space-y-4">
        <FormError message={state.error} />
        <div>
          <Label htmlFor="su-fullName" className="mb-1.5">{t("fullName")}</Label>
          <Input id="su-fullName" name="fullName" autoComplete="name" required />
          <FieldError errors={state.fieldErrors?.fullName} />
        </div>
        <div>
          <Label htmlFor="su-email" className="mb-1.5">{t("email")}</Label>
          <Input id="su-email" name="email" type="email" autoComplete="email" required />
          <FieldError errors={state.fieldErrors?.email} />
        </div>
        <div>
          <Label htmlFor="su-password" className="mb-1.5">{t("password")}</Label>
          <Input
            id="su-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          <FieldError errors={state.fieldErrors?.password} />
        </div>
        <div>
          <Label htmlFor="su-occupation" className="mb-1.5">{tAud("fieldLabel")}</Label>
          <select
            id="su-occupation"
            name="occupation"
            defaultValue=""
            className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink"
          >
            <option value="">{tAud("fieldPlaceholder")}</option>
            {OCCUPATIONS.map((o) => (
              <option key={o} value={o}>
                {tAud(`occ_${o}`)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {t("submitSignup")}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500">
        {t("haveAccount")}{" "}
        <button
          type="button"
          onClick={onLogin}
          className="font-medium text-navy-600 hover:underline"
        >
          {t("goLogin")}
        </button>
      </p>

      {otpEnabled && (
        <>
          <Divider label={t("orDivider")} />
          <button
            type="button"
            onClick={onUsePhone}
            className="w-full text-center text-sm font-medium text-navy-600 hover:underline"
          >
            {t("usePhone")}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * The card heading. It lives inside the panels rather than on the page,
 * because the heading has to name the step: a server-rendered "enter your
 * phone number" sitting above the email form is worse than no heading at all.
 */
function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="space-y-1">
      <h1 className="font-heading text-2xl font-semibold text-navy-800">{title}</h1>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </header>
  );
}

/**
 * Group an E.164 Uzbek number the way it is written and read aloud:
 * +998 90 123 45 67. Display only — every stored and submitted value stays in
 * the unspaced E.164 form the schema normalises to.
 */
function formatPhone(phone: string): string {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs text-slate-400">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

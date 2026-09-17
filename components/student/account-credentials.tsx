"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addEmailAction,
  confirmPhoneChangeAction,
  sendEmailVerificationAction,
  sendPhoneChangeCodeAction,
  setPasswordAction,
  type CredentialFormState,
} from "@/lib/account/credential-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: CredentialFormState = {};

export type CredentialState = {
  email: string | null;
  emailVerified: boolean;
  /** An address claimed but not yet confirmed — it is not on the account. */
  pendingEmail: string | null;
  phone: string | null;
  phoneVerified: boolean;
  hasPassword: boolean;
  otpEnabled: boolean;
};

/**
 * The other half of the two-way sign-in: whichever credential an account was
 * created with, this is where it grows the other one.
 *
 * A phone-first student has no email and no password; an email-first student
 * has no phone. Neither could previously add what they were missing, so an
 * account was permanently stuck with the single way in it was born with — and
 * for phone-first accounts that also meant no address for receipts or
 * certificates.
 */
export function AccountCredentials({
  eyebrow,
  ...props
}: CredentialState & { eyebrow?: string }) {
  const t = useTranslations("Account");

  return (
    <section className="rounded-2xl border border-lp-line bg-surface p-6 shadow-[0_2px_10px_rgba(2,58,105,.05)]">
      {eyebrow && (
        <p className="mb-1 text-[.72rem] font-bold uppercase tracking-[.14em] text-lp-gold-deep">
          {eyebrow}
        </p>
      )}
      <h2 className="font-lp-heading text-[1.2rem] font-semibold text-lp-navy">
        {t("credentialsTitle")}
      </h2>
      <p className="mt-1 max-w-prose text-[.88rem] leading-relaxed text-lp-slate">
        {t("credentialsSubtitle")}
      </p>

      <div className="mt-5 divide-y divide-lp-line-soft">
        <PhoneRow {...props} />
        <EmailRow {...props} />
        <PasswordRow hasPassword={props.hasPassword} />
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  status,
  actionLabel,
  /** An extra control beside the edit button — e.g. "verify this address". */
  secondaryAction,
  note,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  status?: { text: string; tone: "ok" | "warn" | "muted" };
  actionLabel: string;
  secondaryAction?: React.ReactNode;
  note?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const tone =
    status?.tone === "ok"
      ? "bg-success/10 text-success"
      : status?.tone === "warn"
        ? "bg-warning/10 text-warning"
        : "bg-slate-100 text-slate-500";

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-navy-800">{label}</p>
          <p className="mt-0.5 truncate text-sm text-ink">{value}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {status && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
              {status.text}
            </span>
          )}
          {secondaryAction}
          <Button type="button" variant="outline" size="sm" onClick={onToggle}>
            {actionLabel}
          </Button>
        </div>
      </div>
      {note}
      {open && <div className="mt-4 max-w-md">{children}</div>}
    </div>
  );
}

// ── Phone ───────────────────────────────────────────────────────────────────

function PhoneRow({ phone, phoneVerified, otpEnabled }: CredentialState) {
  const t = useTranslations("Account");
  const tAuth = useTranslations("Auth");
  const [open, setOpen] = useState(false);

  const [sendState, sendAction, sending] = useActionState(
    sendPhoneChangeCodeAction,
    initial,
  );
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmPhoneChangeAction,
    initial,
  );

  // The send result the student tapped "cancel" on. Storing the object rather
  // than a flag means the next send is a different object and so is not
  // cancelled — no reset step to remember.
  const [cancelled, setCancelled] = useState<CredentialFormState | null>(null);

  // A code is outstanding while one has been sent, not cancelled, and not yet
  // accepted. All three facts already live in the action states.
  const pendingPhone =
    sendState.step === "code" && sendState !== cancelled && !confirmState.ok
      ? (sendState.phone ?? null)
      : null;

  return (
    <Row
      label={t("phoneLabel")}
      value={phone ?? t("notSet")}
      status={
        phone
          ? phoneVerified
            ? { text: t("verified"), tone: "ok" }
            : { text: t("unverified"), tone: "warn" }
          : undefined
      }
      actionLabel={phone ? t("changePhone") : t("addPhone")}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      {!otpEnabled ? (
        <p className="text-sm text-slate-500">{t("phoneUnavailable")}</p>
      ) : confirmState.ok ? (
        <p className="text-sm text-success">{confirmState.message}</p>
      ) : pendingPhone ? (
        <form action={confirmAction} className="space-y-3">
          <input type="hidden" name="phone" value={pendingPhone} />
          <p className="text-sm text-slate-500">
            {tAuth("codeSentTo", { phone: pendingPhone })}
          </p>
          {confirmState.error && (
            <p className="text-sm text-danger">{confirmState.error}</p>
          )}
          {confirmState.fieldErrors?.phone && (
            <p className="text-sm text-danger">{confirmState.fieldErrors.phone[0]}</p>
          )}
          <div>
            <Label htmlFor="cred-code" className="mb-1.5">{t("codeLabel")}</Label>
            <Input
              id="cred-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              pattern="[0-9]{4}"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={confirming}>
              {t("confirm")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCancelled(sendState)}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <form action={sendAction} className="space-y-3">
          {sendState.error && <p className="text-sm text-danger">{sendState.error}</p>}
          <div>
            <Label htmlFor="cred-phone" className="mb-1.5">{t("phoneLabel")}</Label>
            <Input
              id="cred-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={tAuth("phonePlaceholder")}
              required
            />
            {sendState.fieldErrors?.phone && (
              <p className="mt-1 text-sm text-danger">{sendState.fieldErrors.phone[0]}</p>
            )}
          </div>
          <Button type="submit" size="sm" disabled={sending}>
            {t("sendCode")}
          </Button>
        </form>
      )}
    </Row>
  );
}

// ── Email ───────────────────────────────────────────────────────────────────

function EmailRow({ email, emailVerified, pendingEmail }: CredentialState) {
  const t = useTranslations("Account");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addEmailAction, initial);
  const [sendState, sendAction, sending] = useActionState(
    sendEmailVerificationAction,
    initial,
  );

  // An address on the account but unconfirmed needs a way forward that is not
  // "change email" — it is the same address, and nothing about it is changing.
  const needsVerifying = Boolean(email) && !emailVerified;

  return (
    <Row
      label={t("emailLabel")}
      value={email ?? t("notSet")}
      status={
        email
          ? emailVerified
            ? { text: t("verified"), tone: "ok" }
            : { text: t("unverified"), tone: "warn" }
          : undefined
      }
      secondaryAction={
        needsVerifying ? (
          <form action={sendAction}>
            <Button type="submit" size="sm" disabled={sending}>
              {t("verify")}
            </Button>
          </form>
        ) : undefined
      }
      note={
        needsVerifying || sendState.ok || sendState.error ? (
          <p
            className={`mt-2 text-sm ${sendState.error ? "text-danger" : sendState.ok ? "text-success" : "text-slate-500"}`}
          >
            {sendState.error ?? sendState.message ?? t("unverifiedHint")}
          </p>
        ) : undefined
      }
      actionLabel={email ? t("changeEmail") : t("addEmail")}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <div className="space-y-3">
        {/* A claim is shown here, not in the row above, because until it is
            confirmed the address is genuinely not on the account. */}
        {pendingEmail && !state.ok && (
          <div className="rounded-lg border border-line bg-slate-50 p-3">
            <p className="text-sm text-ink">{t("pendingEmail", { email: pendingEmail })}</p>
            <form action={sendAction}>
              <button
                type="submit"
                disabled={sending}
                className="mt-1 text-sm font-medium text-navy-600 hover:underline disabled:opacity-50"
              >
                {t("resendLink")}
              </button>
            </form>
          </div>
        )}

        {state.ok && state.message && (
          <p className="rounded-lg border border-line bg-slate-50 p-3 text-sm text-ink">
            {state.message}
          </p>
        )}

        <form action={action} className="space-y-3">
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          <div>
            <Label htmlFor="cred-email" className="mb-1.5">{t("emailLabel")}</Label>
            <Input
              id="cred-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            {state.fieldErrors?.email && (
              <p className="mt-1 text-sm text-danger">{state.fieldErrors.email[0]}</p>
            )}
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {t("save")}
          </Button>
        </form>
      </div>
    </Row>
  );
}

// ── Password ────────────────────────────────────────────────────────────────

function PasswordRow({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("Account");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(setPasswordAction, initial);

  return (
    <Row
      label={t("passwordLabel")}
      value={hasPassword ? "••••••••" : t("notSet")}
      actionLabel={hasPassword ? t("changePassword") : t("setPassword")}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <form action={action} className="space-y-3">
        {!hasPassword && <p className="text-sm text-slate-500">{t("noPasswordYet")}</p>}
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {state.ok && <p className="text-sm text-success">{state.message}</p>}

        {hasPassword && (
          <div>
            <Label htmlFor="cred-current" className="mb-1.5">{t("currentPassword")}</Label>
            <Input
              id="cred-current"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
            {state.fieldErrors?.currentPassword && (
              <p className="mt-1 text-sm text-danger">
                {state.fieldErrors.currentPassword[0]}
              </p>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="cred-new" className="mb-1.5">{t("newPassword")}</Label>
          <Input
            id="cred-new"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
          />
          <p className="mt-1 text-xs text-slate-500">{t("passwordHint")}</p>
          {state.fieldErrors?.newPassword && (
            <p className="mt-1 text-sm text-danger">{state.fieldErrors.newPassword[0]}</p>
          )}
        </div>

        <div>
          <Label htmlFor="cred-confirm" className="mb-1.5">{t("confirmPassword")}</Label>
          <Input
            id="cred-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
          {state.fieldErrors?.confirmPassword && (
            <p className="mt-1 text-sm text-danger">
              {state.fieldErrors.confirmPassword[0]}
            </p>
          )}
        </div>

        <Button type="submit" size="sm" disabled={pending}>
          {hasPassword ? t("changePassword") : t("setPassword")}
        </Button>
      </form>
    </Row>
  );
}

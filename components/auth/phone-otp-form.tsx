"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  requestOtpAction,
  verifyOtpLoginAction,
  type AuthFormState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError, FormSuccess } from "./form-bits";

const initial: AuthFormState = {};

/**
 * Two-step phone login: request code → verify code. Gated by `otpEnabled`
 * (OTP_LOGIN_ENABLED) — until Eskiz onboarding is done, the fields are disabled
 * with a notice. In dev the code is logged to the server console.
 */
export function PhoneOtpForm({ otpEnabled }: { otpEnabled: boolean }) {
  const t = useTranslations("Auth");
  const [phone, setPhone] = useState("");
  const [requestState, requestAction, requesting] = useActionState(
    requestOtpAction,
    initial,
  );
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyOtpLoginAction,
    initial,
  );

  const codeSent = requestState.ok;

  if (!otpEnabled) {
    return (
      <div className="space-y-4">
        <FormError message={t("otpDisabled")} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={requestAction} className="space-y-4">
        <FormError message={requestState.error} />
        {codeSent && <FormSuccess message={requestState.message} />}
        <div>
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+998901234567"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <FieldError errors={requestState.fieldErrors?.phone} />
        </div>
        <Button type="submit" variant="outline" className="w-full" disabled={requesting}>
          {t("sendOtp")}
        </Button>
      </form>

      {codeSent && (
        <form action={verifyAction} className="space-y-4">
          <FormError message={verifyState.error} />
          <input type="hidden" name="phone" value={phone} />
          <div>
            <Label htmlFor="code">{t("code")}</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
            <FieldError errors={verifyState.fieldErrors?.code} />
          </div>
          <Button type="submit" className="w-full" disabled={verifying}>
            {t("verifyOtp")}
          </Button>
        </form>
      )}
    </div>
  );
}

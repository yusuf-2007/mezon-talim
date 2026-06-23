"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { loginAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldError, FormError } from "./form-bits";
import { PhoneOtpForm } from "./phone-otp-form";

const initial: AuthFormState = {};

export function LoginForm({ otpEnabled }: { otpEnabled: boolean }) {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <Tabs defaultValue="email" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="email">{t("emailTab")}</TabsTrigger>
        <TabsTrigger value="phone">{t("phoneTab")}</TabsTrigger>
      </TabsList>

      <TabsContent value="email">
        <form action={action} className="space-y-4">
          <FormError message={state.error} />
          <div>
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
            <FieldError errors={state.fieldErrors?.email} />
          </div>
          <div>
            <div className="flex items-center justify-between">
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
      </TabsContent>

      <TabsContent value="phone">
        <PhoneOtpForm otpEnabled={otpEnabled} />
      </TabsContent>
    </Tabs>
  );
}

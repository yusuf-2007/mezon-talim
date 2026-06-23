import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { env } from "@/lib/env";
import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LoginPage() {
  const t = await getTranslations("Auth");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl text-navy-800">
          {t("loginTitle")}
        </CardTitle>
        <CardDescription>{t("loginSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LoginForm otpEnabled={env.OTP_LOGIN_ENABLED} />
        <p className="text-center text-sm text-slate-500">
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-medium text-navy-600 hover:underline">
            {t("goSignup")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

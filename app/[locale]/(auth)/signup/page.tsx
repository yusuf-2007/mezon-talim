import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SignupPage() {
  const t = await getTranslations("Auth");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl text-navy-800">
          {t("signupTitle")}
        </CardTitle>
        <CardDescription>{t("signupSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SignupForm />
        <p className="text-center text-sm text-slate-500">
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium text-navy-600 hover:underline">
            {t("goLogin")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

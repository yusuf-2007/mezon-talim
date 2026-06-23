import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { RequestResetForm } from "@/components/auth/request-reset-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ResetPage() {
  const t = await getTranslations("Auth");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl text-navy-800">
          {t("resetTitle")}
        </CardTitle>
        <CardDescription>{t("resetSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RequestResetForm />
        <p className="text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-navy-600 hover:underline">
            {t("goLogin")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

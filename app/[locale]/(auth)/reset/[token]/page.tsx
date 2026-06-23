import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ResetTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const t = await getTranslations("Auth");
  const { token } = await params;
  const { email } = await searchParams;
  // The reset link carries email + token; both are required.
  if (!email) notFound();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl text-navy-800">
          {t("newPasswordTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm email={email} token={token} />
      </CardContent>
    </Card>
  );
}

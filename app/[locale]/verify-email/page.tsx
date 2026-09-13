import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BrandWordmark } from "@/components/brand-wordmark";
import { SiteShell } from "@/components/site-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Result of following an email-confirmation link. The work happens in
 * /api/verify-email/[token] — see that handler for why.
 *
 * Deliberately outside the (auth) route group: that layout bounces signed-in
 * visitors to their dashboard, and the person following this link is normally
 * signed in already, which would have made the link silently do nothing.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const t = await getTranslations("Auth");
  const user = await getCurrentUser();

  const copy =
    status === "ok"
      ? { title: t("verifyEmailOkTitle"), body: t("verifyEmailOkBody") }
      : status === "taken"
        ? { title: t("verifyEmailTakenTitle"), body: t("verifyEmailTakenBody") }
        : {
            title: t("verifyEmailInvalidTitle"),
            body: t("verifyEmailInvalidBody"),
          };

  return (
    <SiteShell>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center px-4 py-12">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <BrandWordmark />
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-navy-800">
              {copy.title}
            </CardTitle>
            <CardDescription>{copy.body}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              render={<Link href={user ? "/dashboard/settings" : "/login"} />}
              className="w-full"
            >
              {user ? t("goToProfile") : t("submitLogin")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </SiteShell>
  );
}

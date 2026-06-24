import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { ComingSoon } from "@/components/admin/coming-soon";

export default async function AdminAnalyticsPage() {
  await requireRole("super_admin", "accountant");
  const t = await getTranslations("Admin");
  return <ComingSoon title={t("analyticsTitle")} note={t("comingSoon")} />;
}

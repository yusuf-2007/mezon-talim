import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";

export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations("Account");
  return (
    <DashboardPlaceholder
      title={t("studentTitle")}
      subtitle={t("studentSubtitle")}
      user={user}
    />
  );
}

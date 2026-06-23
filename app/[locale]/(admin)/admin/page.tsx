import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";

export default async function AdminPage() {
  const user = await requireRole("super_admin", "accountant");
  const t = await getTranslations("Account");
  return (
    <DashboardPlaceholder
      title={t("adminTitle")}
      subtitle={t("adminSubtitle")}
      user={user}
    />
  );
}

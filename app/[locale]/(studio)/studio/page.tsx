import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";

export default async function StudioPage() {
  const user = await requireRole("teacher", "super_admin");
  const t = await getTranslations("Account");
  return (
    <DashboardPlaceholder
      title={t("studioTitle")}
      subtitle={t("studioSubtitle")}
      user={user}
    />
  );
}

import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { ComingSoon } from "@/components/admin/coming-soon";

export default async function AdminEnrollmentsPage() {
  await requireRole("super_admin");
  const t = await getTranslations("Admin");
  return <ComingSoon title={t("enrollmentsTitle")} note={t("comingSoon")} />;
}

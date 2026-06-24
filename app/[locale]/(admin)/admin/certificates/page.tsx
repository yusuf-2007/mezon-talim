import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { ComingSoon } from "@/components/admin/coming-soon";

export default async function AdminCertificatesPage() {
  await requireRole("super_admin");
  const t = await getTranslations("Admin");
  return <ComingSoon title={t("certificatesTitle")} note={t("comingSoon")} />;
}

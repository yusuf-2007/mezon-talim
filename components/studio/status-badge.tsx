import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

type Status = "draft" | "published" | "archived";

const styles: Record<Status, string> = {
  draft: "bg-gold-100 text-navy-800",
  published: "bg-navy-100 text-navy-800",
  archived: "bg-line text-slate-500",
};

export function StatusBadge({ status }: { status: Status }) {
  const t = useTranslations("Studio");
  const label =
    status === "published"
      ? t("statusPublished")
      : status === "archived"
        ? t("statusArchived")
        : t("statusDraft");
  return <Badge className={styles[status]}>{label}</Badge>;
}

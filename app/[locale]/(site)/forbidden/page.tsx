import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";

export default async function ForbiddenPage() {
  const t = await getTranslations("Auth");
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-28 text-center sm:px-6">
      <p className="font-heading text-6xl font-semibold text-navy-800">403</p>
      <h1 className="mt-4 font-heading text-2xl font-semibold text-navy-800">
        {t("forbiddenTitle")}
      </h1>
      <p className="mt-2 text-slate-500">{t("forbiddenBody")}</p>
      <Button render={<Link href="/" />} className="mt-8">
        {t("backHome")}
      </Button>
    </div>
  );
}

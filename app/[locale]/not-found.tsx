import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("Nav");
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-28 text-center sm:px-6">
      <p className="font-heading text-6xl font-semibold text-navy-800">404</p>
      <Button render={<Link href="/" />} className="mt-8">
        {t("courses")}
      </Button>
    </div>
  );
}

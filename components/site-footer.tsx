import { getTranslations } from "next-intl/server";
import { BrandWordmark } from "@/components/brand-wordmark";
import { LanguageSwitcher } from "@/components/language-switcher";

export async function SiteFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="border-t border-line bg-navy-900 text-navy-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <BrandWordmark tone="light" />
          <p className="max-w-sm text-sm text-navy-100/80">{t("tagline")}</p>
        </div>
        <div className="flex flex-col items-start gap-4 md:items-end">
          <LanguageSwitcher />
          <p className="text-xs text-navy-100/60">
            © Mezon Ta&apos;lim. {t("rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}

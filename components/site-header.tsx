import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BrandWordmark } from "@/components/brand-wordmark";
import { LanguageSwitcher } from "@/components/language-switcher";

/**
 * Light top bar that sits above the navy hero. Nav targets are placeholders;
 * real routes (catalog, auth) arrive in later phases.
 */
export async function SiteHeader() {
  const t = await getTranslations("Nav");

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center">
          <BrandWordmark />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-500 md:flex">
          <Link href="/" className="transition-colors hover:text-navy-800">
            {t("courses")}
          </Link>
          <Link href="/" className="transition-colors hover:text-navy-800">
            {t("about")}
          </Link>
          <Link href="/" className="transition-colors hover:text-navy-800">
            {t("faq")}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Button
            render={<Link href="/" />}
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
          >
            {t("login")}
          </Button>
        </div>
      </div>
    </header>
  );
}

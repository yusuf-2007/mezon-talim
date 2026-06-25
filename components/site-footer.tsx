import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { BrandWordmark } from "@/components/brand-wordmark";
import { LanguageSwitcher } from "@/components/language-switcher";

export async function SiteFooter() {
  const [t, nav] = await Promise.all([
    getTranslations("Footer"),
    getTranslations("Nav"),
  ]);

  const links = [
    { href: "/catalog", label: nav("courses") },
    { href: "/about", label: nav("about") },
    { href: "/faq", label: nav("faq") },
  ] as const;

  return (
    <footer className="border-t border-line bg-navy-900 text-navy-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <BrandWordmark tone="light" />
          <p className="max-w-sm text-sm text-navy-100/80">{t("tagline")}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-navy-100/80 transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
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

"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Segmented UZ / RU switcher. Re-links the current pathname under the chosen
 * locale (next-intl preserves the route). Keyboard- and screen-reader-friendly.
 */
export function LanguageSwitcher() {
  const pathname = usePathname();
  const active = useLocale();
  const t = useTranslations("LanguageSwitcher");

  return (
    <nav aria-label={t("label")} className="flex items-center rounded-md border border-line bg-surface p-0.5 text-sm">
      {routing.locales.map((locale) => {
        const isActive = locale === active;
        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "rounded-[6px] px-2.5 py-1 font-medium uppercase transition-colors",
              isActive
                ? "bg-navy-800 text-white"
                : "text-slate-500 hover:text-navy-800",
            )}
          >
            {locale}
          </Link>
        );
      })}
    </nav>
  );
}

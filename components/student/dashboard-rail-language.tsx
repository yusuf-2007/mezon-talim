"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Compact locale switch for the navy rail.
 *
 * The shared LanguageSwitcher is built for light chrome — white ground, navy
 * active pill — and disappears against the rail. Same behaviour, inverted
 * palette, and small enough to sit beside the log-out control.
 */
export function RailLanguage() {
  const pathname = usePathname();
  const active = useLocale();
  const t = useTranslations("LanguageSwitcher");

  return (
    <nav
      aria-label={t("label")}
      className="flex overflow-hidden rounded-[6px] border border-white/15 bg-white/[.07] text-[.72rem] font-bold"
    >
      {routing.locales.map((locale) => {
        const isActive = locale === active;
        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "px-2.5 py-1.5 uppercase transition-colors",
              isActive
                ? "bg-lp-gold text-lp-navy-deep"
                : "text-lp-on-navy-dim hover:text-white",
            )}
          >
            {locale}
          </Link>
        );
      })}
    </nav>
  );
}

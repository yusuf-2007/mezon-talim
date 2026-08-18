"use client";

import Image from "next/image";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "#kurs", key: "course" },
  { href: "#aaoifi", key: "aaoifi" },
  { href: "#ustozlar", key: "teachers" },
  { href: "#savollar", key: "faq" },
] as const;

/**
 * Sticky marketing header. Distinct from `SiteHeader` (the app chrome): this
 * one leads with the "Ariza qoldirish" CTA rather than sign-up, because courses
 * run in cohorts and the sale is consultative.
 *
 * The design's header carries no auth affordance, but a returning student still
 * needs a way into the LMS, so the nav keeps a log-in link. It always points at
 * /login — that layout redirects an already-signed-in user to their own landing
 * path, which keeps this page free of a session lookup.
 */
export function LandingHeader({ loginLabel }: { loginLabel: string }) {
  const t = useTranslations("Landing.nav");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-60 border-b border-lp-line bg-[rgb(255_255_255/0.94)] backdrop-blur-[12px]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-5 px-6 py-[13px]">
        <Link href="/" className="flex min-h-11 shrink-0 items-center" aria-label={t("logoAlt")}>
          <Image
            src="/brand/mezon-logo-horizontal.png"
            alt={t("logoAlt")}
            width={440}
            height={87}
            priority
            className="h-[30px] w-auto"
          />
        </Link>

        <nav className="flex gap-7 text-[0.92rem] font-semibold text-lp-slate max-[980px]:hidden">
          {SECTIONS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="transition-colors hover:text-lp-navy"
            >
              {t(s.key)}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-[11px]">
          <LocaleToggle className="max-[620px]:hidden" />
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-[9px] bg-lp-tint px-[18px] text-[0.9rem] font-bold whitespace-nowrap text-lp-navy transition-colors hover:bg-lp-navy hover:text-white max-[980px]:px-[14px] max-[980px]:text-[0.82rem] max-[620px]:hidden"
          >
            {loginLabel}
          </Link>
          <a
            href="#ariza"
            className="lp-gold inline-flex min-h-11 items-center rounded-[9px] bg-lp-gold px-[18px] text-[0.9rem] font-bold whitespace-nowrap text-lp-navy-deep shadow-[0_4px_14px_rgb(248_184_1/0.28)] max-[980px]:px-[14px] max-[980px]:text-[0.82rem]"
          >
            {t("apply")}
          </a>
          <button
            type="button"
            aria-label={t("menu")}
            aria-expanded={open}
            aria-controls="lp-mobile-nav"
            onClick={() => setOpen((v) => !v)}
            className="hidden h-11 w-11 shrink-0 place-items-center rounded-[9px] border border-lp-line bg-white max-[980px]:grid"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-lp-navy"
              aria-hidden
            >
              {open ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <path d="M3 6h18M3 12h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div
        id="lp-mobile-nav"
        hidden={!open}
        className="border-t border-lp-line bg-white"
      >
        <div className="mx-auto flex max-w-[1200px] flex-col px-6 pt-2 pb-[18px]">
          {SECTIONS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              onClick={close}
              className="border-b border-lp-line-soft py-[13px] text-base font-semibold text-lp-ink"
            >
              {t(s.key)}
            </a>
          ))}
          {/* Both actions are full-width buttons here: below 620 the header
              cluster has no room for the log-in control, so the menu is where
              it has to stay prominent. */}
          <div className="flex flex-col gap-2.5 pt-4">
            <Link
              href="/login"
              onClick={close}
              className="inline-flex min-h-11 items-center justify-center rounded-[9px] bg-lp-tint px-5 text-[0.95rem] font-bold text-lp-navy"
            >
              {loginLabel}
            </Link>
            <a
              href="#ariza"
              onClick={close}
              className="inline-flex min-h-11 items-center justify-center rounded-[9px] bg-lp-gold px-5 text-[0.95rem] font-bold text-lp-navy-deep"
            >
              {t("apply")}
            </a>
            {/* self-start so the toggle keeps its content width instead of
                stretching across the column like the two buttons above it. */}
            <div className="self-start pt-1">
              <LocaleToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Segmented locale switcher in the design's style. The design mocked RU as a
 * disabled "coming soon" chip; all three locales are in fact translated, so
 * this links them for real rather than showing a dead control.
 */
function LocaleToggle({ className }: { className?: string }) {
  const pathname = usePathname();
  const active = useLocale();
  const t = useTranslations("LanguageSwitcher");

  return (
    <nav
      aria-label={t("label")}
      className={cn(
        "flex overflow-hidden rounded-lg border border-lp-line bg-lp-wash text-[0.8rem] font-bold",
        className,
      )}
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
              "flex min-h-11 items-center px-3 uppercase transition-colors",
              isActive
                ? "bg-lp-navy text-white"
                : "text-lp-muted-light hover:text-lp-navy",
            )}
          >
            {locale}
          </Link>
        );
      })}
    </nav>
  );
}

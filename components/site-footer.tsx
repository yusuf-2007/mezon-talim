import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { InlineLanguage } from "@/components/site-header-parts";

export async function SiteFooter() {
  const [t, nav] = await Promise.all([getTranslations("Footer"), getTranslations("Nav")]);

  const links = [
    { href: "/catalog", label: nav("courses") },
    { href: "/about", label: nav("about") },
    { href: "/faq", label: nav("faq") },
  ] as const;

  return (
    <footer className="bg-lp-navy-deep px-5 pb-6 pt-10 sm:px-12">
      <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img
            src="/brand/mezon-logo-horizontal-white.png"
            alt="Mezon Ta'lim"
            width={142}
            height={28}
            className="block h-7 w-auto"
          />
          <p className="mt-3 max-w-[44ch] text-[.84rem] leading-relaxed text-lp-on-navy-dim">
            {t("tagline")}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-x-[26px] gap-y-3 text-[.88rem] text-lp-on-navy">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-white">
              {l.label}
            </Link>
          ))}
          <InlineLanguage tone="dark" />
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-[1200px] text-[.74rem] text-lp-on-navy-faint">
        © Mezon Ta&apos;lim. {t("rights")}
      </p>
    </footer>
  );
}

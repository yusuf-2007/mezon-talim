import { getTranslations } from "next-intl/server";
import { Bracket } from "./bracket";
import { TelegramIcon } from "./icons";

/**
 * Marketing footer. The open-book mark is drawn in CSS (two skewed pages, navy
 * + gold) rather than loaded as an image, so it stays crisp on the dark band.
 * Legal requisites and contacts are still bracketed placeholders.
 */
export async function LandingFooter() {
  const t = await getTranslations("Landing.footer");

  return (
    <footer className="relative overflow-hidden bg-lp-navy-deep">
      <div className="relative mx-auto max-w-[1200px] px-6 pt-15 pb-7">
        <div className="grid grid-cols-[1.7fr_1fr_1fr] gap-11 max-[980px]:grid-cols-1">
          <div>
            <div className="mb-4 flex items-center gap-[11px]">
              <span
                aria-hidden
                className="relative inline-block h-[25px] w-8 shrink-0"
              >
                <span className="absolute top-0 left-0 h-[25px] w-3.5 skew-x-[-6deg] rounded-[3px_0_0_8px] bg-lp-navy-mid" />
                <span className="absolute top-0 right-0 h-[25px] w-3.5 skew-x-[6deg] rounded-[0_3px_8px_0] bg-lp-gold" />
              </span>
              <span className="font-lp-heading text-[1.3rem] font-semibold">
                <span className="text-white">Mezon</span>{" "}
                <span className="text-lp-gold">Ta&rsquo;lim</span>
              </span>
            </div>
            <p className="max-w-[44ch] text-[0.92rem] leading-[1.65] text-lp-on-navy-dim">
              {t("tagline")}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Bracket tone="navy" className="px-[11px] py-1 text-[0.76rem]">
                {t("entity")}
              </Bracket>
              <Bracket tone="navy" className="px-[11px] py-1 text-[0.76rem]">
                {t("address")}
              </Bracket>
            </div>
          </div>

          <div>
            <div className="mb-4 text-[0.74rem] font-bold tracking-[0.12em] text-lp-on-navy-faint uppercase">
              {t("coursesLabel")}
            </div>
            {/* min-h-11 gives each link a 44px tap row on mobile; the visual
                rhythm is preserved by trimming the gap to match. */}
            <nav className="flex flex-col gap-0.5 text-[0.92rem]">
              <a
                href="#kurs"
                className="flex min-h-11 items-center text-lp-on-navy hover:text-white"
              >
                {t("cpss")}
              </a>
              <a
                href="#kurs"
                className="flex min-h-11 items-center text-lp-on-navy hover:text-white"
              >
                {t("bim")}
              </a>
              <a
                href="#aaoifi"
                className="flex min-h-11 items-center text-lp-on-navy hover:text-white"
              >
                {t("aaoifi")}
              </a>
              <a
                href="#savollar"
                className="flex min-h-11 items-center text-lp-on-navy hover:text-white"
              >
                {t("faq")}
              </a>
            </nav>
          </div>

          <div>
            <div className="mb-4 text-[0.74rem] font-bold tracking-[0.12em] text-lp-on-navy-faint uppercase">
              {t("contactLabel")}
            </div>
            <div className="flex flex-col items-start gap-[11px] text-[0.92rem]">
              <Bracket tone="navy" className="px-[11px] py-1 text-[0.76rem]">
                {t("phone")}
              </Bracket>
              <Bracket tone="navy" className="px-[11px] py-1 text-[0.76rem]">
                {t("email")}
              </Bracket>
              {/* URL still outstanding — inert rather than href="#". */}
              <span className="inline-flex min-h-11 items-center gap-2 text-lp-on-navy-dim">
                <TelegramIcon size={14} className="text-lp-on-navy-dim" />
                {t("telegram")}
              </span>
              <span className="text-lp-on-navy">{t("site")}</span>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-[18px] border-t border-white/10 pt-[22px]">
          <div className="text-[0.85rem] text-lp-on-navy-faint">{t("rights")}</div>
        </div>
      </div>
    </footer>
  );
}

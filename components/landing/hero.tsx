import { getTranslations } from "next-intl/server";
import { Bracket } from "./bracket";
import { PhotoSlot } from "./photo-slot";

/**
 * Navy hero band with the gold primary CTA — the brand's signature move
 * (design-system §1). The eyebrow carries the positioning line; the full
 * AAOIFI status chain is stated verbatim in the section directly below.
 */
export async function Hero() {
  const t = await getTranslations("Landing.hero");

  return (
    <section className="relative overflow-hidden bg-lp-navy">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[180px] -right-[120px] h-[540px] w-[540px] rounded-full bg-[radial-gradient(circle_at_42%_42%,rgb(11_76_130/0.62),transparent_64%)]"
      />
      <div className="relative mx-auto grid max-w-[1200px] grid-cols-[1.1fr_0.9fr] items-center gap-14 px-6 pt-[76px] pb-[88px] max-[980px]:grid-cols-1 max-[980px]:gap-10">
        <div>
          <div className="mb-[26px] inline-flex items-center gap-[11px]">
            <span aria-hidden className="h-0.5 w-8 shrink-0 bg-lp-gold" />
            <span className="text-[0.74rem] leading-[1.4] font-bold tracking-[0.14em] text-lp-gold-light uppercase">
              {t("eyebrow")}
            </span>
          </div>

          <h1 className="font-lp-heading text-[clamp(2.3rem,5vw,4rem)] leading-[1.03] font-semibold tracking-[-0.025em] text-white">
            {t("title")}
          </h1>

          <p className="mt-5 font-lp-heading text-[clamp(1.15rem,2.2vw,1.5rem)] leading-[1.35] font-medium text-lp-gold-light italic">
            {t("tagline")}
          </p>

          <p className="mt-5 max-w-[50ch] text-[1.08rem] leading-[1.65] text-lp-on-navy">
            {t("lead")}
          </p>

          <div className="mt-[34px] flex flex-wrap gap-[13px]">
            <a
              href="#ariza"
              className="lp-gold rounded-[11px] bg-lp-gold px-7 py-[15px] text-base font-bold text-lp-navy-deep shadow-[0_6px_20px_rgb(248_184_1/0.32)]"
            >
              {t("ctaPrimary")}
            </a>
            <a
              href="#ariza"
              className="rounded-[11px] border-[1.5px] border-white/30 bg-white/7 px-[26px] py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t("ctaSecondary")}
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="text-[0.82rem] font-bold tracking-[0.1em] text-lp-on-navy-dim uppercase">
              {t("cohortLabel")}
            </span>
            <Bracket tone="navy" className="px-3 py-1 text-[0.85rem]">
              {t("cohortDate")}
            </Bracket>
            <span className="text-[0.85rem] text-lp-on-navy-dim">
              {t("cohortNote")}
            </span>
          </div>
        </div>

        <div className="relative max-[980px]:max-w-[460px] max-[620px]:max-w-none">
          <div className="relative aspect-4/5 overflow-hidden rounded-[18px] bg-lp-navy-dark shadow-[0_24px_60px_rgb(1_20_40/0.5)] max-[980px]:aspect-3/2">
            <PhotoSlot caption={t("photoAlt")} />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-to-b from-lp-navy/16 to-lp-navy-deep/50 mix-blend-multiply"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-0 h-1 w-full bg-lp-gold"
            />
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute top-3.5 left-3.5 h-[26px] w-[26px] border-t-2 border-l-2 border-lp-gold"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute top-3.5 right-3.5 h-[26px] w-[26px] border-t-2 border-r-2 border-lp-gold"
          />

          <div className="absolute -bottom-5 -left-5 flex max-w-[250px] items-center gap-3 rounded-[13px] bg-white p-[15px_17px] shadow-[0_16px_36px_rgb(1_20_40/0.34)]">
            <span
              aria-hidden
              className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[11px] bg-lp-gold-tint"
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-lp-gold-deep"
              >
                <circle cx="12" cy="8" r="6" />
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
              </svg>
            </span>
            <div>
              <div className="text-[0.9rem] leading-[1.3] font-bold text-lp-navy">
                {t("badgeTitle")}
              </div>
              <div className="text-[0.76rem] leading-[1.3] text-lp-muted">
                {t("badgeSub")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

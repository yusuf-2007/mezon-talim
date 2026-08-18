import { getTranslations } from "next-intl/server";
import { ApplyForm } from "./apply-form";
import { Bracket } from "./bracket";
import { Reveal } from "./reveal";

/** Final CTA: next-cohort card on the left, the lead form on the right. */
export async function ApplySection() {
  const t = await getTranslations("Landing.apply");

  return (
    <section id="ariza" className="scroll-mt-20 border-b border-lp-line bg-lp-wash">
      <div className="mx-auto max-w-[1200px] px-6 py-[88px] max-[980px]:py-[60px]">
        <div className="grid grid-cols-2 items-start gap-11 max-[980px]:grid-cols-1">
          <Reveal>
            <div className="mb-3.5 text-[0.74rem] font-bold tracking-[0.16em] text-lp-gold-deep uppercase">
              {t("eyebrow")}
            </div>
            <h2 className="font-lp-heading text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.14] font-semibold tracking-[-0.015em] text-lp-navy">
              {t("title")}
            </h2>
            <p className="mt-4 max-w-[46ch] text-[1.05rem] leading-[1.65] text-lp-slate">
              {t("lead")}
            </p>

            <div className="relative mt-8 overflow-hidden rounded-2xl bg-lp-navy p-[26px]">
              <div className="relative">
                <div className="mb-3 text-[0.72rem] font-bold tracking-[0.14em] text-lp-gold-light uppercase">
                  {t("cohortLabel")}
                </div>
                <div className="mb-3.5 flex flex-wrap items-center gap-3.5">
                  <Bracket tone="navy" className="px-3.5 py-1.5 text-base">
                    {t("cohortDate")}
                  </Bracket>
                  <span className="text-[0.9rem] text-lp-on-navy">
                    {t("cohortMeta")}
                  </span>
                </div>
                <p className="mb-[18px] text-[0.9rem] leading-[1.55] text-lp-on-navy-dim">
                  {t("cohortNote")}
                </p>
                <a
                  href="#ariza"
                  className="inline-flex items-center gap-2.5 rounded-[10px] border-[1.5px] border-white/28 bg-white/8 px-[18px] py-[11px] text-[0.9rem] font-semibold text-white transition-colors hover:bg-white/15"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-lp-gold"
                    aria-hidden
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {t("waitlist")}
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <ApplyForm />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

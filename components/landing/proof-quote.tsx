import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";

/**
 * Full-bleed navy pull-quote from a graduate. The source label is mandatory:
 * this speaker completed the BIM (entrepreneurs) course, not CPSS, and must
 * never read as a CPSS graduate.
 */
export async function ProofQuote() {
  const t = await getTranslations("Landing.quote");

  return (
    <section className="relative overflow-hidden bg-lp-navy">
      <div className="relative mx-auto max-w-[900px] px-6 py-[84px]">
        <Reveal>
          <figure>
            <div
              aria-hidden
              className="h-8 font-lp-heading text-[4rem] leading-[0] text-lp-gold"
            >
              &ldquo;
            </div>
            <blockquote className="mt-2 font-lp-heading text-[clamp(1.4rem,3vw,2.05rem)] leading-[1.36] font-medium text-white italic">
              {t("text")}
            </blockquote>
            <figcaption className="mt-8 flex flex-wrap items-center gap-3.5">
              <span
                aria-hidden
                className="grid h-13 w-13 shrink-0 place-items-center rounded-full bg-lp-navy-mid text-[0.9rem] font-bold text-white"
              >
                {t("initials")}
              </span>
              <div>
                <div className="text-base font-bold text-white">{t("name")}</div>
                <div className="text-[0.9rem] text-lp-on-navy-dim">
                  {t("role")}
                </div>
              </div>
              <span className="ml-1 inline-flex items-center gap-[7px] rounded-[7px] border border-white/16 bg-white/8 px-3 py-1.5 text-[0.76rem] font-semibold text-lp-on-navy">
                {t("label")}
              </span>
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";

type Tier1 = { initials: string; name: string; role: string; quote: string };
type Tier2 = { quote: string; name: string };

/**
 * Graduate testimonials. Every card carries the source label: these are BIM
 * (entrepreneurs) graduates, and the section says so in its own lead text —
 * the first CPSS cohort has not finished, so nothing here may read as CPSS.
 */
export async function Testimonials() {
  const t = await getTranslations("Landing.testimonials");
  const tier1 = t.raw("tier1") as Tier1[];
  const tier2 = t.raw("tier2") as Tier2[];

  return (
    <section className="border-b border-lp-line bg-lp-wash">
      <div className="mx-auto max-w-[1200px] px-6 py-[88px] max-[980px]:py-[60px]">
        <Reveal className="mb-11 max-w-[56ch]">
          <div className="mb-3.5 text-[0.74rem] font-bold tracking-[0.16em] text-lp-gold-deep uppercase">
            {t("eyebrow")}
          </div>
          <h2 className="font-lp-heading text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.14] font-semibold tracking-[-0.015em] text-lp-navy">
            {t("title")}
          </h2>
          <p className="mt-3.5 text-base leading-[1.6] text-lp-slate">
            {t("lead")}
          </p>
        </Reveal>

        <div className="mb-[22px] grid grid-cols-2 gap-[22px] max-[980px]:grid-cols-1">
          {tier1.map((item) => (
            <Reveal key={item.name}>
              <figure className="lp-lift h-full rounded-2xl border border-lp-line bg-white p-7 shadow-[0_2px_10px_rgb(2_58_105/0.05)]">
                <blockquote className="mb-[22px] font-lp-heading text-[1.1rem] leading-[1.5] text-lp-ink italic">
                  {item.quote}
                </blockquote>
                <figcaption>
                  <div className="flex items-center gap-[13px]">
                    <span
                      aria-hidden
                      className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-lp-tint text-[0.85rem] font-bold text-lp-navy"
                    >
                      {item.initials}
                    </span>
                    <div>
                      <div className="text-[0.95rem] font-bold text-lp-navy">
                        {item.name}
                      </div>
                      <div className="text-[0.85rem] text-lp-muted">
                        {item.role}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-lp-line-soft pt-[13px]">
                    <span className="inline-flex items-center gap-[7px] rounded-md bg-lp-wash px-[11px] py-[5px] text-[0.75rem] font-semibold text-lp-slate">
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="text-lp-muted"
                        aria-hidden
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                      </svg>
                      {t("sourceLabel")}
                    </span>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="grid grid-cols-4 overflow-hidden rounded-2xl border border-lp-line bg-white max-[620px]:grid-cols-1">
            {tier2.map((item, i) => (
              <figure
                key={item.name}
                className={`p-[22px_24px] ${
                  i === 0
                    ? ""
                    : "border-l border-lp-line-soft max-[620px]:border-t max-[620px]:border-l-0"
                }`}
              >
                <blockquote className="mb-3 font-lp-heading text-[0.95rem] leading-[1.5] text-lp-ink italic">
                  {item.quote}
                </blockquote>
                <figcaption className="text-[0.82rem] font-bold text-lp-muted">
                  {item.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

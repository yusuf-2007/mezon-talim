import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";
import { ChevronDownIcon } from "./icons";

type Item = { q: string; a: string };

/**
 * FAQ accordion built on native <details>, so it opens without JavaScript and
 * the answers stay in the page for crawlers. Questions are the real objections
 * from the discovery document, with answers Mezon has already approved.
 */
export async function Faq() {
  const t = await getTranslations("Landing.faq");
  const items = t.raw("items") as Item[];

  return (
    <section
      id="savollar"
      className="scroll-mt-20 border-b border-lp-line bg-white"
    >
      <div className="mx-auto max-w-[860px] px-6 py-[88px] max-[980px]:py-[60px]">
        <Reveal className="mb-10">
          <div className="mb-3.5 text-[0.74rem] font-bold tracking-[0.16em] text-lp-gold-deep uppercase">
            {t("eyebrow")}
          </div>
          <h2 className="font-lp-heading text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.14] font-semibold tracking-[-0.015em] text-lp-navy">
            {t("title")}
          </h2>
        </Reveal>

        <Reveal>
          {items.map((item) => (
            <details key={item.q} className="lp-faq border-t border-lp-line">
              <summary className="flex items-center justify-between gap-5 py-[22px]">
                <span className="font-lp-heading text-[1.1rem] leading-[1.35] font-semibold text-lp-navy">
                  {item.q}
                </span>
                <ChevronDownIcon className="lp-cv shrink-0 text-lp-gold-deep" />
              </summary>
              <p className="max-w-[70ch] pb-[22px] text-base leading-[1.65] text-lp-slate">
                {item.a}
              </p>
            </details>
          ))}
          <div className="border-t border-lp-line" />
        </Reveal>
      </div>
    </section>
  );
}

import { getTranslations } from "next-intl/server";
import { Bracket } from "./bracket";
import { Reveal } from "./reveal";

/** The "why now" market-data strip: the law, the growth, the roadmap, the gap. */
export async function WhyNow() {
  const t = await getTranslations("Landing.whyNow");

  const cells = [
    { value: t("d1Value"), body: t("d1Body"), accent: false },
    { value: t("d2Value"), body: t("d2Body"), accent: false },
    { value: t("d3Value"), body: t("d3Body"), accent: false },
    { value: t("d4Value"), body: t("d4Body"), accent: true },
  ];

  return (
    <section className="border-b border-lp-line bg-lp-wash">
      <div className="mx-auto max-w-[1200px] px-6 py-[88px] max-[980px]:py-[60px]">
        <Reveal className="mb-11 max-w-[52ch]">
          <div className="mb-3.5 text-[0.74rem] font-bold tracking-[0.16em] text-lp-gold-deep uppercase">
            {t("eyebrow")}
          </div>
          <h2 className="font-lp-heading text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.14] font-semibold tracking-[-0.015em] text-lp-navy">
            {t("title")}
          </h2>
        </Reveal>

        <Reveal>
          <div className="grid grid-cols-4 max-[980px]:grid-cols-2 max-[620px]:grid-cols-1">
            {cells.map((cell, i) => (
              <div
                key={cell.value}
                className={
                  i === 0
                    ? "pr-7 max-[980px]:pr-0"
                    : "border-l border-lp-line-strong px-7 max-[980px]:mt-1 max-[980px]:border-l-0 max-[980px]:border-t max-[980px]:border-lp-line max-[980px]:px-0 max-[980px]:pt-[18px]"
                }
              >
                <div
                  className={`lp-settle mb-2.5 font-lp-heading text-[2rem] leading-[1.05] font-semibold ${
                    cell.accent ? "text-lp-gold-deep" : "text-lp-navy"
                  }`}
                >
                  {cell.value}
                </div>
                <div className="text-[0.92rem] leading-[1.55] text-lp-slate">
                  {cell.body}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-7 border-t border-lp-line-strong pt-[18px] text-[0.85rem] text-lp-muted">
            {t("source")}{" "}
            <Bracket className="px-2 py-0.5 text-[0.8rem]">
              {t("sourceLinks")}
            </Bracket>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

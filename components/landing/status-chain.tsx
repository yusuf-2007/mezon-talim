import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";
import { DiamondIcon } from "./icons";

/**
 * AAOIFI → Mezon Kengashi → Mezon Ta'lim. The chain exists to state the
 * relationship precisely: Mezon Ta'lim is the education centre of Mezon
 * Kengashi, which is AAOIFI's official representative. Shortening that to
 * "Mezon Ta'lim is AAOIFI's official representative" would falsely imply direct
 * AAOIFI accreditation, so the full sentence is kept verbatim below the chain.
 */
export async function StatusChain() {
  const t = await getTranslations("Landing.chain");

  return (
    <section id="aaoifi" className="scroll-mt-20 border-b border-lp-line bg-white">
      <div className="mx-auto max-w-[1200px] px-6 py-16">
        {/* The chain is self-explanatory visually, but this section is a nav
            target ("AAOIFI haqida") and had no heading — a screen-reader user
            jumping here landed in unlabelled prose. */}
        <h2 className="sr-only">{t("heading")}</h2>
        <Reveal>
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-5 max-[980px]:grid-cols-1 max-[980px]:gap-2">
            <ChainNode title={t("aaoifiTitle")} sub={t("aaoifiSub")} />
            <ChainSeparator />
            <ChainNode title={t("kengashTitle")} sub={t("kengashSub")} />
            <ChainSeparator />
            <div className="relative px-3 py-4 text-center">
              <span
                aria-hidden
                className="absolute inset-0 rounded-xl border-[1.5px] border-lp-gold bg-lp-cream"
              />
              <div className="relative">
                <div className="mb-[7px] font-lp-heading text-2xl font-semibold text-lp-navy">
                  {t("talimTitle")}
                </div>
                <div className="text-[0.85rem] leading-[1.45] font-semibold text-lp-gold-ink">
                  {t("talimSub")}
                </div>
              </div>
            </div>
          </div>

          <p className="mx-auto mt-[34px] max-w-[74ch] border-t border-lp-line-soft pt-[26px] text-center font-lp-heading text-[1.05rem] leading-[1.6] text-lp-slate">
            {t("statement")}
          </p>
          <p className="mx-auto mt-3.5 max-w-[66ch] text-center text-[0.95rem] leading-[1.6] text-lp-muted">
            {t("edge")}
            <b className="text-lp-slate">{t("edgeStrong")}</b>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function ChainNode({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="text-center">
      <div className="mb-[7px] font-lp-heading text-2xl font-semibold text-lp-navy">
        {title}
      </div>
      <div className="text-[0.85rem] leading-[1.45] text-lp-muted">{sub}</div>
    </div>
  );
}

function ChainSeparator() {
  return (
    <div
      aria-hidden
      className="flex flex-col items-center gap-[5px] max-[980px]:rotate-90"
    >
      <DiamondIcon className="text-lp-gold-deep" />
      <span className="h-px w-[30px] bg-lp-gold-line" />
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";

/**
 * The two certificates, deliberately kept visually apart: AAOIFI awards CPSS
 * through its own exam; Mezon Ta'lim issues a course-completion certificate.
 * Blurring the two would misrepresent the credential, so they get separate
 * cards and an explicit "separate documents" divider.
 */
export async function Certificates() {
  const t = await getTranslations("Landing.certificates");

  return (
    <section className="border-b border-lp-line bg-white">
      <div className="mx-auto max-w-[1200px] px-6 py-[88px] max-[980px]:py-[60px]">
        <Reveal className="mb-11 max-w-[58ch]">
          <div className="mb-3.5 text-[0.74rem] font-bold tracking-[0.16em] text-lp-gold-deep uppercase">
            {t("eyebrow")}
          </div>
          <h2 className="font-lp-heading text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.14] font-semibold tracking-[-0.015em] text-lp-navy">
            {t("title")}
          </h2>
          <p className="mt-4 text-[1.05rem] leading-[1.65] text-lp-slate">
            {t("leadBefore")}
            <b className="text-lp-ink">{t("leadStrong")}</b>
            {t("leadAfter")}
          </p>
        </Reveal>

        <Reveal>
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-[26px] max-[980px]:grid-cols-1">
            <div className="relative overflow-hidden rounded-2xl border-2 border-lp-navy bg-white p-[30px]">
              <div
                aria-hidden
                className="absolute top-0 left-0 h-[5px] w-full bg-linear-to-r from-lp-navy to-lp-gold"
              />
              <div className="relative">
                <div className="mb-3 text-[0.72rem] font-bold tracking-[0.16em] text-lp-gold-deep uppercase">
                  {t("aaoifiLabel")}
                </div>
                <h3 className="mb-3 font-lp-heading text-2xl font-semibold text-lp-navy">
                  {t("aaoifiTitle")}
                </h3>
                <p className="mb-5 text-[0.95rem] leading-[1.6] text-lp-slate">
                  {t("aaoifiBody")}
                </p>
                <div className="inline-flex items-center gap-2 rounded-full bg-lp-tint px-3.5 py-1.5">
                  <span
                    aria-hidden
                    className="h-[7px] w-[7px] rounded-full bg-lp-navy"
                  />
                  <span className="text-[0.8rem] font-bold text-lp-navy">
                    {t("aaoifiChip")}
                  </span>
                </div>
              </div>
            </div>

            <div
              aria-hidden
              className="flex flex-col items-center justify-center gap-3 max-[980px]:h-auto max-[980px]:flex-row max-[980px]:py-2"
            >
              <span className="w-px flex-1 bg-lp-line max-[980px]:h-px max-[980px]:w-auto" />
              <span className="[writing-mode:vertical-rl] rotate-180 text-[0.72rem] font-bold tracking-[0.12em] whitespace-nowrap text-lp-muted uppercase max-[980px]:rotate-0 max-[980px]:[writing-mode:horizontal-tb]">
                {t("separator")}
              </span>
              <span className="w-px flex-1 bg-lp-line max-[980px]:h-px max-[980px]:w-auto" />
            </div>

            <div className="rounded-2xl border border-lp-line bg-lp-wash-alt p-[30px]">
              <div className="mb-3 text-[0.72rem] font-bold tracking-[0.16em] text-lp-muted uppercase">
                {t("mezonLabel")}
              </div>
              <h3 className="mb-3 font-lp-heading text-2xl font-semibold text-lp-navy">
                {t("mezonTitle")}
              </h3>
              <p className="mb-5 text-[0.95rem] leading-[1.6] text-lp-slate">
                {t("mezonBody")}
              </p>
              <div className="inline-flex items-center gap-2 rounded-full bg-lp-line-soft px-3.5 py-1.5">
                <span
                  aria-hidden
                  className="h-[7px] w-[7px] rounded-full bg-lp-muted"
                />
                <span className="text-[0.8rem] font-bold text-lp-slate">
                  {t("mezonChip")}
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

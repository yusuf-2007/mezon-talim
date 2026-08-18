import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";

/** The secondary course (Islamic Finance in Business), for entrepreneurs. */
export async function BimCourse() {
  const t = await getTranslations("Landing.bim");

  const stats = [
    { value: t("lessons"), label: t("lessonsLabel") },
    { value: t("months"), label: t("monthsLabel") },
    { value: t("cohort"), label: t("cohortLabel") },
  ];

  return (
    <section className="border-b border-lp-line bg-lp-wash">
      <div className="mx-auto max-w-[1200px] px-6 py-16">
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-9 rounded-[18px] border border-lp-line bg-white p-[34px_38px] shadow-[0_2px_10px_rgb(2_58_105/0.05)]">
            <div className="min-w-[280px] flex-1">
              <div className="mb-2.5 text-[0.72rem] font-bold tracking-[0.14em] text-lp-muted uppercase">
                {t("eyebrow")}
              </div>
              <h3 className="mb-2.5 font-lp-heading text-[1.65rem] font-semibold text-lp-navy">
                {t("title")}
              </h3>
              <p className="max-w-[56ch] text-[0.95rem] leading-[1.6] text-lp-slate">
                {t("body")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-[26px]">
              <div className="flex gap-[22px]">
                {stats.map((s) => (
                  <div key={s.label}>
                    <div className="font-lp-heading text-2xl leading-none font-semibold text-lp-navy">
                      {s.value}
                    </div>
                    <div className="mt-[3px] text-[0.8rem] text-lp-muted">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
              <a
                href="#ariza"
                className="rounded-[10px] border-[1.5px] border-lp-navy bg-white px-[22px] py-3 text-[0.92rem] font-bold whitespace-nowrap text-lp-navy transition-colors hover:bg-lp-wash"
              >
                {t("cta")}
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

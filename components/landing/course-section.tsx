import { getTranslations } from "next-intl/server";
import { Bracket } from "./bracket";
import { Reveal } from "./reveal";
import { CheckIcon } from "./icons";

type Fact = { k: string; v: string };
type Outcome = { t: string; d: string };

/** The flagship CPSS course: structure table on the left, outcomes on the right. */
export async function CourseSection() {
  const t = await getTranslations("Landing.course");

  const facts = t.raw("facts") as Fact[];
  const outcomes = t.raw("outcomes") as Outcome[];
  const includes = t.raw("includes") as string[];

  return (
    <section id="kurs" className="scroll-mt-20 border-b border-lp-line bg-white">
      <div className="mx-auto max-w-[1200px] px-6 py-[88px] max-[980px]:py-[60px]">
        <Reveal className="mb-12 max-w-[56ch]">
          <div className="mb-3.5 text-[0.74rem] font-bold tracking-[0.16em] text-lp-gold-deep uppercase">
            {t("eyebrow")}
          </div>
          <h2 className="font-lp-heading text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.14] font-semibold tracking-[-0.015em] text-lp-navy">
            {t("title")}
          </h2>
          <p className="mt-4 text-[1.05rem] leading-[1.65] text-lp-slate">
            {t("lead")}
          </p>
        </Reveal>

        <div className="grid grid-cols-2 items-start gap-13 max-[980px]:grid-cols-1">
          <Reveal>
            <div className="mb-[18px] text-[0.74rem] font-bold tracking-[0.14em] text-lp-muted uppercase">
              {t("structureLabel")}
            </div>
            <dl>
              {facts.map((f) => (
                <div
                  key={f.k}
                  className="flex items-baseline justify-between gap-5 border-b border-lp-line-soft py-[15px]"
                >
                  <dt className="text-[0.95rem] text-lp-slate">{f.k}</dt>
                  <dd className="text-right font-lp-heading text-[1.1rem] font-semibold text-lp-navy">
                    {/* A fact Mezon has not settled yet renders as a visible
                        placeholder rather than plain text, so it reads the same
                        as every other unresolved value on the page. */}
                    {f.v.startsWith("[") ? (
                      <Bracket className="px-3 py-[3px] text-[0.85rem]">
                        {f.v}
                      </Bracket>
                    ) : (
                      f.v
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="text-[0.85rem] text-lp-muted">
                {t("priceLabel")}
              </span>
              <Bracket className="px-3 py-[5px] text-[0.85rem]">
                {t("price")}
              </Bracket>
              <span className="text-[0.85rem] text-lp-muted">
                {t("priceNote")}
              </span>
            </div>
          </Reveal>

          <Reveal>
            <div className="mb-[18px] text-[0.74rem] font-bold tracking-[0.14em] text-lp-muted uppercase">
              {t("outcomesLabel")}
            </div>
            <ul className="flex flex-col gap-[18px]">
              {outcomes.map((o) => (
                <li key={o.t} className="flex items-start gap-3.5">
                  <span
                    aria-hidden
                    className="mt-px grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[7px] bg-lp-tint"
                  >
                    <CheckIcon className="text-lp-navy" />
                  </span>
                  <div>
                    <div className="mb-[3px] text-base font-bold text-lp-ink">
                      {o.t}
                    </div>
                    <div className="text-[0.92rem] leading-[1.55] text-lp-slate">
                      {o.d}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-[26px] rounded-xl border border-lp-line bg-lp-wash p-[18px_20px]">
              <div className="mb-2.5 text-[0.74rem] font-bold tracking-[0.12em] text-lp-muted uppercase">
                {t("includesLabel")}
              </div>
              <ul className="flex flex-wrap gap-2">
                {includes.map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-lp-line bg-white px-3 py-[5px] text-[0.82rem] text-lp-slate"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[0.85rem] text-lp-muted">{t("curators")}</p>
            </div>

            <a
              href="#ariza"
              className="lp-gold mt-[26px] inline-block rounded-[11px] bg-lp-gold px-[26px] py-3.5 text-[0.95rem] font-bold text-lp-navy-deep shadow-[0_6px_18px_rgb(248_184_1/0.3)]"
            >
              {t("cta")}
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

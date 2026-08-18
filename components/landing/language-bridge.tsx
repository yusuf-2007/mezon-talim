import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";

type Row = { tag: string; t: string; d: string };

/**
 * The honest answer to the biggest objection: lessons are in Uzbek but the
 * AAOIFI exam is in English and Arabic. Stated openly and then turned into a
 * differentiator — the programme's built-in language bridge.
 */
export async function LanguageBridge() {
  const t = await getTranslations("Landing.bridge");
  const rows = t.raw("rows") as Row[];

  return (
    <section className="border-b border-lp-line bg-lp-wash">
      <div className="mx-auto max-w-[1200px] px-6 py-[88px] max-[980px]:py-[60px]">
        <Reveal>
          <div className="grid grid-cols-2 items-center gap-13 max-[980px]:grid-cols-1">
            <div>
              <div className="mb-3.5 text-[0.74rem] font-bold tracking-[0.16em] text-lp-gold-deep uppercase">
                {t("eyebrow")}
              </div>
              <h2 className="font-lp-heading text-[clamp(1.7rem,3vw,2.3rem)] leading-[1.18] font-semibold tracking-[-0.015em] text-lp-navy">
                {t("title")}
              </h2>
              <p className="mt-[18px] text-[1.02rem] leading-[1.65] text-lp-slate">
                {t("body")}
              </p>
            </div>

            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <li
                  key={row.tag}
                  className="flex items-center gap-4 rounded-xl border border-lp-line bg-white p-[16px_18px]"
                >
                  <span
                    className={`shrink-0 rounded-md px-2.5 py-[5px] text-[0.74rem] font-extrabold tracking-[0.06em] ${
                      row.tag === "UZ/EN"
                        ? "bg-lp-gold-tint text-lp-gold-ink"
                        : "bg-lp-tint text-lp-navy"
                    }`}
                  >
                    {row.tag}
                  </span>
                  <div>
                    <div className="text-[0.95rem] font-bold text-lp-ink">
                      {row.t}
                    </div>
                    <div className="mt-0.5 text-[0.85rem] text-lp-muted">
                      {row.d}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";

/**
 * B2B band. Banks sending staff are the priority segment, so group enrolment
 * and corporate invoicing get their own section rather than a footnote.
 */
export async function Organisations() {
  const t = await getTranslations("Landing.b2b");

  const items = [
    {
      title: t("item1Title"),
      body: t("item1Body"),
      icon: (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <path d="M20 8v6M23 11h-6" />
        </>
      ),
    },
    {
      title: t("item2Title"),
      body: t("item2Body"),
      icon: (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M9 13h6M9 17h6" />
        </>
      ),
    },
    {
      title: t("item3Title"),
      body: t("item3Body"),
      icon: (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </>
      ),
    },
  ];

  return (
    <section className="relative overflow-hidden bg-lp-navy">
      <div className="relative mx-auto max-w-[1200px] px-6 py-[88px] max-[980px]:py-[60px]">
        <Reveal>
          <div className="grid grid-cols-2 items-center gap-13 max-[980px]:grid-cols-1">
            <div>
              <div className="mb-3.5 text-[0.74rem] font-bold tracking-[0.16em] text-lp-gold-light uppercase">
                {t("eyebrow")}
              </div>
              <h2 className="font-lp-heading text-[clamp(1.8rem,3.2vw,2.4rem)] leading-[1.16] font-semibold tracking-[-0.015em] text-white">
                {t("title")}
              </h2>
              <p className="mt-[18px] max-w-[48ch] text-[1.02rem] leading-[1.65] text-lp-on-navy">
                {t("body")}
              </p>
              <a
                href="#ariza"
                className="lp-gold mt-7 inline-block rounded-[11px] bg-lp-gold px-[26px] py-3.5 text-[0.95rem] font-bold text-lp-navy-deep shadow-[0_6px_20px_rgb(248_184_1/0.3)]"
              >
                {t("cta")}
              </a>
            </div>

            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li
                  key={item.title}
                  className="flex items-start gap-3.5 rounded-xl border border-white/14 bg-white/6 p-[18px_20px]"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    className="mt-0.5 shrink-0 text-lp-gold"
                    aria-hidden
                  >
                    {item.icon}
                  </svg>
                  <div>
                    <div className="mb-[3px] text-[0.95rem] font-bold text-white">
                      {item.title}
                    </div>
                    <div className="text-[0.9rem] leading-[1.5] text-lp-on-navy-dim">
                      {item.body}
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

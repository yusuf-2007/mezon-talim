import { getTranslations } from "next-intl/server";
import { PhotoSlot } from "./photo-slot";
import { Reveal } from "./reveal";

type Teacher = { name: string; role: string; creds: string[] };

/** Three instructor portraits with credentials — the page's main trust asset. */
export async function Instructors() {
  const t = await getTranslations("Landing.teachers");
  const teachers = t.raw("list") as Teacher[];

  return (
    <section
      id="ustozlar"
      className="scroll-mt-20 border-b border-lp-line bg-white"
    >
      <div className="mx-auto max-w-[1200px] px-6 py-[88px] max-[980px]:py-[60px]">
        <Reveal className="mb-11 max-w-[54ch]">
          <div className="mb-3.5 text-[0.74rem] font-bold tracking-[0.16em] text-lp-gold-deep uppercase">
            {t("eyebrow")}
          </div>
          <h2 className="font-lp-heading text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.14] font-semibold tracking-[-0.015em] text-lp-navy">
            {t("title")}
          </h2>
        </Reveal>

        <div className="grid grid-cols-3 gap-[26px] max-[980px]:grid-cols-1">
          {teachers.map((teacher) => (
            <Reveal key={teacher.name}>
              <div className="relative mb-5">
                <div className="relative aspect-4/5 overflow-hidden rounded-[14px] bg-lp-navy-dark">
                  <PhotoSlot caption={t("portraitAlt")} />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-linear-to-b from-lp-navy/10 to-lp-navy-deep/42 mix-blend-multiply"
                  />
                </div>
                <span
                  aria-hidden
                  className="pointer-events-none absolute -bottom-px left-3.5 h-6 w-6 border-b-2 border-l-2 border-lp-gold"
                />
              </div>

              <h3 className="mb-[5px] font-lp-heading text-[1.3rem] font-semibold text-lp-navy">
                {teacher.name}
              </h3>
              <div className="mb-3.5 text-[0.9rem] font-semibold text-lp-gold-deep">
                {teacher.role}
              </div>
              <ul className="flex flex-col gap-2">
                {teacher.creds.map((cred) => (
                  <li key={cred} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-lp-gold"
                    />
                    <span className="text-[0.92rem] leading-[1.5] text-lp-slate">
                      {cred}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

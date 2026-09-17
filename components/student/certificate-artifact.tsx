import { getLocale } from "next-intl/server";
import { pickLocale } from "@/lib/i18n/localized";
import { Lattice, CornerMarks } from "./lattice";
import type { LocalizedText } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/routing";

/**
 * A scale drawing of the certificate itself, not an icon of one.
 *
 * The document is what the student is working towards, so the dashboard shows
 * the thing rather than a graduation-cap glyph standing in for it. Sized by its
 * container with everything in `clamp`/percentage units, so the same component
 * serves the small card on the home view and the large one on the certificates
 * page without a second implementation drifting away from the first.
 */
export async function CertificateArtifact({
  studentName,
  courseTitle,
  issuedAt,
  verificationCode,
  detailed = false,
}: {
  studentName: string;
  courseTitle: LocalizedText;
  issuedAt: Date;
  verificationCode: string;
  /** The large variant adds the signature line and issuing statement. */
  detailed?: boolean;
}) {
  const locale = (await getLocale()) as Locale;
  const dateLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ";
  const issued = new Date(issuedAt).toLocaleDateString(dateLocale);

  return (
    <div className="relative">
      <div
        className="relative overflow-hidden rounded-md border-2 border-lp-navy bg-white shadow-[0_18px_44px_rgba(2,58,105,.16)]"
        style={{ aspectRatio: "1.414" }}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[7px]"
          style={{ background: "linear-gradient(90deg,#023a69,#f8b801)" }}
        />
        <Lattice size={30} opacity={0.05} color="%23023A69" />
        <div className="relative flex h-full flex-col justify-between px-[8%] pb-[6%] pt-[8%] text-center">
          <div>
            <p
              className="font-lp-heading font-semibold tracking-[.04em] text-lp-navy"
              style={{ fontSize: "clamp(.8rem,1.6vw,1.05rem)" }}
            >
              MEZON <span className="text-lp-gold-deep">TA&rsquo;LIM</span>
            </p>
            <p
              className="mt-[5%] font-bold uppercase tracking-[.22em] text-lp-gold-deep"
              style={{ fontSize: "clamp(.5rem,.9vw,.62rem)" }}
            >
              {locale === "ru"
                ? "Сертификат о завершении курса"
                : locale === "en"
                  ? "Certificate of completion"
                  : "Kursni yakunlaganlik sertifikati"}
            </p>
          </div>
          <div>
            <p
              className="font-lp-heading font-semibold text-lp-navy"
              style={{ fontSize: "clamp(1rem,2.8vw,2rem)", margin: "2% 0" }}
            >
              {studentName}
            </p>
            <p
              className="mx-auto max-w-[44ch] leading-relaxed text-lp-slate"
              style={{ fontSize: "clamp(.5rem,1vw,.72rem)" }}
            >
              <b className="text-lp-ink">{pickLocale(courseTitle, locale)}</b>
            </p>
          </div>
          <div className="flex items-end justify-between gap-[4%]">
            <div
              className="text-left leading-relaxed text-lp-muted"
              style={{ fontSize: "clamp(.45rem,.8vw,.58rem)" }}
            >
              <span className="mb-[3px] block w-16 border-t border-lp-line-strong" />
              {issued}
              <br />
              <span className="font-mono text-lp-slate">{verificationCode}</span>
            </div>
            <span
              aria-hidden
              className="grid shrink-0 place-items-center rounded-full bg-lp-gold shadow-[0_4px_12px_rgba(248,184,1,.4)]"
              style={{ width: "clamp(28px,5vw,46px)", height: "clamp(28px,5vw,46px)" }}
            >
              <svg width="55%" height="55%" viewBox="0 0 24 24" fill="none" stroke="#011E38" strokeWidth="2">
                <circle cx="12" cy="8" r="6" />
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
              </svg>
            </span>
            {detailed ? (
              <div
                className="text-right leading-relaxed text-lp-muted"
                style={{ fontSize: "clamp(.45rem,.8vw,.58rem)" }}
              >
                <span className="mb-[3px] block w-full border-t border-lp-line-strong" />
                Mezon Ta&rsquo;lim
              </div>
            ) : (
              <span className="w-8" />
            )}
          </div>
        </div>
      </div>
      <CornerMarks inset="-9px" size="24px" />
    </div>
  );
}

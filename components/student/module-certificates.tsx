import { Award } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ModuleCertLedgerRow } from "@/lib/learning/milestones";
import type { Locale } from "@/lib/i18n/routing";

/**
 * A course's module certificates as one compact ledger under that course.
 *
 * A course can carry four to ten of these, so they are rows rather than the
 * large documents the course certificate gets: what each module is, whether
 * its certificate is earned (with the code and the two actions), revoked, or
 * what still stands in the way.
 */
export async function ModuleCertificates({ rows }: { rows: ModuleCertLedgerRow[] }) {
  const [t, locale] = await Promise.all([
    getTranslations("Student"),
    getLocale() as Promise<Locale>,
  ]);
  if (rows.length === 0) return null;
  const dateLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ";
  const earned = rows.filter((r) => r.status === "earned").length;

  return (
    <section
      className="mt-3 overflow-hidden rounded-2xl border border-lp-line bg-surface shadow-[0_2px_10px_rgba(2,58,105,.05)]"
      data-testid="module-certificates"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-lp-line-soft px-6 py-4">
        <div>
          <p className="text-[.72rem] font-bold uppercase tracking-[.14em] text-lp-gold-deep">
            {t("moduleCertsTitle")}
          </p>
          <p className="mt-1 text-[.82rem] text-lp-slate">{t("moduleCertsBody")}</p>
        </div>
        <span className="font-lp-heading text-[1.1rem] font-semibold text-lp-navy tabular-nums">
          {t("moduleCertsCount", { done: earned, total: rows.length })}
        </span>
      </div>

      <ul>
        {rows.map((r) => {
          const title = pickLocale(r.title, locale) || t("moduleCertDeleted");
          const label = r.number != null ? t("resumeModule", { n: r.number }) : t("moduleCertDeleted");
          return (
            <li
              key={r.key}
              className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 border-b border-lp-line-soft px-6 py-3.5 last:border-b-0 sm:grid-cols-[30px_minmax(0,1fr)_auto]"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-[28px] place-items-center rounded-full text-[.8rem] font-bold tabular-nums",
                  r.status === "earned"
                    ? "bg-lp-gold text-lp-navy-deep"
                    : r.status === "revoked"
                      ? "border-[1.5px] border-lp-line-strong text-lp-muted"
                      : "border-[1.5px] border-dashed border-lp-line-strong text-lp-muted",
                )}
              >
                {r.status === "earned" ? <Award className="size-3.5" strokeWidth={2.2} /> : (r.number ?? "–")}
              </span>
              <div className="min-w-0">
                <p className="text-[.74rem] font-bold uppercase tracking-[.1em] text-lp-muted">{label}</p>
                <p
                  className={cn(
                    "truncate text-[.92rem] font-bold",
                    r.status === "earned" ? "text-lp-ink" : "text-lp-slate",
                  )}
                >
                  {title}
                </p>
                {r.cert && (
                  <p className="mt-0.5 text-[.8rem] text-lp-muted tabular-nums">
                    {new Date(r.cert.issuedAt).toLocaleDateString(dateLocale)} ·{" "}
                    <span className="font-mono text-lp-slate">{r.cert.code}</span>
                  </p>
                )}
              </div>
              <div className="col-start-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[.84rem] sm:col-start-3 sm:justify-end">
                {r.status === "earned" && r.cert ? (
                  <>
                    <a
                      href={`/api/certificates/${r.cert.code}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-lp-navy-mid hover:underline"
                    >
                      {t("pdfShort")}
                    </a>
                    <Link
                      href={`/verify/${r.cert.code}`}
                      className="font-bold text-lp-navy-mid hover:underline"
                    >
                      {t("verifyPage")}
                    </Link>
                  </>
                ) : r.status === "revoked" ? (
                  <span className="inline-flex items-center gap-1.5 font-bold text-lp-danger">
                    <span aria-hidden className="size-[7px] rounded-full bg-lp-danger" />
                    {t("certRevoked")}
                  </span>
                ) : (
                  <span className="font-semibold text-lp-muted tabular-nums">
                    {r.status === "pending_exam"
                      ? t("moduleCertPendingExam")
                      : r.status === "passed_pending"
                        ? t("moduleCertPassedPending")
                        : t("moduleCertPendingLessons", {
                            done: r.lessons?.done ?? 0,
                            total: r.lessons?.total ?? 0,
                          })}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-lp-line-soft bg-lp-wash-alt px-6 py-3 text-[.78rem] leading-relaxed text-lp-muted">
        {t("moduleCertDisclaimer")}
      </p>
    </section>
  );
}

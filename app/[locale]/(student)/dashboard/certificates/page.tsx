import { ArrowRight, Award, Download, Lock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { attemptsRepository } from "@/lib/db/repositories/attempts";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { getCurriculum } from "@/lib/learning/curriculum";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/student/page-header";
import { CertificateArtifact } from "@/components/student/certificate-artifact";
import { CopyLinkButton } from "@/components/student/copy-link-button";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/routing";

/**
 * The certificate, shown at a size worth looking at.
 *
 * A student earns perhaps two of these, so the page leads with the document
 * rather than a list of rows — the detail table beside it carries the facts an
 * employer would check, and the disclaimer states plainly what the credential
 * is and is not (CLAUDE.md §6.2: this is Mezon's, not AAOIFI's).
 */
export default async function StudentCertificatesPage() {
  const user = await requireUser();
  const t = await getTranslations("Student");
  const locale = (await getLocale()) as Locale;

  const [certs, enrolled, attempts] = await Promise.all([
    certificatesRepository.listForUserAll(user.id),
    enrollmentsRepository.listActiveWithCourse(user.id),
    attemptsRepository.listForUserAll(user.id),
  ]);

  const dateLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ";
  const fmt = (d: Date) => new Date(d).toLocaleDateString(dateLocale);

  // Courses still without a certificate — what the student is working towards.
  const earnedCourseIds = new Set(certs.map((c) => c.courseId));
  const pending = await Promise.all(
    enrolled
      .filter(({ course }) => !earnedCourseIds.has(course.id))
      .map(async ({ course }) => {
        const [curriculum, exam] = await Promise.all([
          getCurriculum(course.id, user.id),
          assessmentsRepository.findByTypeForCourse(course.id, "final_exam"),
        ]);
        return { course, curriculum, threshold: exam?.passThresholdPct ?? 70 };
      }),
  );

  return (
    <>
      <PageHeader
        eyebrow={t("navCertificates")}
        title={t("subCerts")}
        userId={user.id}
        role={user.role}
      />

      {certs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-lp-line-strong bg-surface p-12 text-center">
          <span
            aria-hidden
            className="mx-auto mb-4 grid size-14 place-items-center rounded-full border-[1.5px] border-dashed border-lp-line-strong text-lp-muted"
          >
            <Award className="size-6" strokeWidth={1.6} />
          </span>
          <p className="font-lp-heading text-[1.3rem] font-semibold text-lp-navy">
            {t("noCertsTitle")}
          </p>
          <p className="mx-auto mt-2 max-w-[48ch] text-[.92rem] leading-relaxed text-lp-slate">
            {t("noCertsBody")}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {certs.map((cert) => {
            const best = attempts
              .filter(
                (a) =>
                  a.assessment.courseId === cert.courseId &&
                  a.assessment.type === "final_exam" &&
                  a.attempt.passed,
              )
              .reduce<{ pct: number; no: number } | null>(
                (acc, a) =>
                  (a.attempt.scorePct ?? 0) > (acc?.pct ?? -1)
                    ? { pct: a.attempt.scorePct ?? 0, no: a.attempt.attemptNo }
                    : acc,
                null,
              );
            const revoked = Boolean(cert.revokedAt);

            return (
              <section
                key={cert.id}
                className="grid items-center gap-8 rounded-2xl border border-lp-line bg-surface p-7 shadow-[0_2px_10px_rgba(2,58,105,.05)] lg:grid-cols-[1.25fr_.75fr]"
              >
                <CertificateArtifact
                  studentName={user.fullName || "—"}
                  courseTitle={cert.courseTitle}
                  issuedAt={cert.issuedAt}
                  verificationCode={cert.verificationCode}
                  detailed
                />

                <div>
                  <p className="mb-2.5 text-[.72rem] font-bold uppercase tracking-[.14em] text-lp-gold-deep">
                    {t("certGiverEyebrow")}
                  </p>
                  <h3 className="mb-3.5 font-lp-heading text-[1.45rem] font-semibold leading-tight text-lp-navy">
                    {pickLocale(cert.courseTitle, locale)}
                  </h3>

                  <dl className="mb-5 border-t border-lp-line-soft text-[.88rem]">
                    <Row label={t("certIssuedOn")} value={fmt(cert.issuedAt)} />
                    {best && (
                      <Row
                        label={t("certFinalExam")}
                        value={`${best.pct}% · ${best.no}`}
                      />
                    )}
                    <Row label={t("certCode")} value={cert.verificationCode} mono />
                    <Row
                      label={t("certStatus")}
                      value={
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 font-bold",
                            revoked ? "text-lp-danger" : "text-lp-success",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "size-[7px] rounded-full",
                              revoked ? "bg-lp-danger" : "bg-lp-success-dot",
                            )}
                          />
                          {revoked ? t("certRevoked") : t("certValid")}
                        </span>
                      }
                    />
                  </dl>

                  {!revoked && (
                    <div className="flex flex-col gap-2.5">
                      <Button
                        render={
                          <a
                            href={`/api/certificates/${cert.verificationCode}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                        size="lg"
                        className="bg-lp-gold text-lp-navy-deep shadow-[0_6px_18px_rgba(248,184,1,.3)] hover:bg-lp-gold"
                      >
                        <Download className="size-4" />
                        {t("downloadPdf")}
                      </Button>
                      <div className="flex gap-2.5">
                        <Button
                          render={<Link href={`/verify/${cert.verificationCode}`} />}
                          variant="outline"
                          className="flex-1"
                        >
                          {t("verifyPage")}
                        </Button>
                        <CopyLinkButton
                          code={cert.verificationCode}
                          label={t("copyLink")}
                        />
                      </div>
                    </div>
                  )}

                  <p className="mt-3.5 text-[.78rem] leading-relaxed text-lp-muted">
                    {t("certDisclaimer")}
                  </p>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {pending.map(({ course, curriculum, threshold }) => (
        <section
          key={course.id}
          className="mt-5 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-dashed border-lp-line-strong px-7 py-6"
        >
          <div className="flex items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border-[1.5px] border-dashed border-lp-line-strong">
              <Lock className="size-[18px] text-lp-muted" strokeWidth={1.75} />
            </span>
            <div>
              <p className="mb-1 text-[.98rem] font-bold text-lp-ink">
                {t("nextCertTitle", { course: pickLocale(course.title, locale) })}
              </p>
              <p className="text-[.86rem] leading-relaxed text-lp-slate">
                {t("nextCertBody", {
                  pct: threshold,
                  done: curriculum.completedCount,
                  total: curriculum.lessonCount,
                })}
              </p>
            </div>
          </div>
          {curriculum.resumeLessonId && (
            <Link
              href={`/learn/${course.id}/${curriculum.resumeLessonId}`}
              className="inline-flex items-center gap-1 text-[.86rem] font-bold text-lp-navy-mid hover:underline"
            >
              {t("resumeContinue")} <ArrowRight className="size-3.5" />
            </Link>
          )}
        </section>
      ))}
    </>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-lp-line-soft py-2.5">
      <dt className="text-lp-muted">{label}</dt>
      <dd className={cn("font-semibold text-lp-ink", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

import { Play } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { enabledPaymentProviders, formatTiyin } from "@/lib/payments";
import { startCheckoutAction } from "@/lib/payments/actions";
import { devEnrollAction } from "@/lib/learning/actions";
import { cn } from "@/lib/utils";
import { Eyebrow, LessonTicks } from "@/components/learn/flow-ui";
import type { FlowLessonState } from "@/lib/learning/flow";

/**
 * The course page's side card. Two modes, one shape:
 *
 * - enrolled: where you are (ticks, "2 / 4") and one button to carry on — to
 *   the next lesson, or to the exam once the lessons are done.
 * - not enrolled: the price and the way to pay, plus the free preview lesson
 *   when there is one.
 *
 * The facts underneath (lessons, exam, access, language) are the same for
 * both, because they describe the course, not the viewer.
 */
export async function EnrollCard({
  courseId,
  coverUrl,
  priceTiyin,
  lessonCount,
  accessDurationDays,
  certificateEnabled,
  isAuthed,
  enrolled,
  lessonStates,
  doneCount,
  resume,
  preview,
  exam,
}: {
  courseId: string;
  coverUrl: string | null;
  priceTiyin: number;
  lessonCount: number;
  accessDurationDays: number;
  certificateEnabled: boolean;
  isAuthed: boolean;
  enrolled: boolean;
  lessonStates: FlowLessonState[];
  doneCount: number;
  resume: { id: string; number: number; title: string } | null;
  preview: { id: string; title: string } | null;
  exam: { id: string; questions: number; threshold: number; passed: boolean } | null;
}) {
  const t = await getTranslations("Course");
  const providers = enabledPaymentProviders();
  const allDone = lessonCount > 0 && doneCount >= lessonCount;

  // Where the thumbnail's play button and the main button lead.
  const next = enrolled
    ? allDone && exam
      ? exam.passed
        ? { href: "/dashboard/certificates", label: t("ctaCertificate") }
        : { href: `/exam/${exam.id}`, label: t("ctaExam") }
      : resume
        ? {
            href: `/learn/${courseId}/${resume.id}`,
            label:
              doneCount === 0
                ? t("ctaStart", { n: resume.number })
                : t("ctaContinue", { n: resume.number }),
          }
        : { href: `/learn/${courseId}`, label: t("goToCourse") }
    : null;

  const thumbHref = next?.href ?? (preview ? `/learn/${courseId}/${preview.id}` : null);
  const thumbLabel = enrolled
    ? resume
      ? t("thumbNext", { title: resume.title })
      : null
    : preview
      ? t("thumbPreview")
      : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-lp-line bg-white shadow-[0_18px_44px_rgba(2,58,105,.16)]">
      {/* Thumbnail */}
      <div
        className="relative aspect-video overflow-hidden bg-lp-navy-dark bg-cover bg-center"
        style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
      >
        {thumbHref && (
          <Link
            href={thumbHref}
            aria-label={next?.label ?? t("previewCta")}
            className="absolute inset-0 grid place-items-center"
          >
            <span className="grid size-[52px] place-items-center rounded-full border-[1.5px] border-white/55 bg-white/[.14] backdrop-blur-[3px] transition-colors hover:bg-white/25">
              <Play className="size-[18px] fill-white text-white" strokeWidth={0} />
            </span>
          </Link>
        )}
        {thumbLabel && (
          <span className="pointer-events-none absolute bottom-3 left-3.5 right-3.5 truncate text-[.8rem] font-semibold text-[#DCE6F0]">
            {thumbLabel}
          </span>
        )}
      </div>

      <div className="px-6 pb-6 pt-[22px]">
        {enrolled && next ? (
          <>
            <div className="mb-2 flex items-baseline justify-between">
              <Eyebrow>{t("yourProgress")}</Eyebrow>
              <span className="font-lp-heading text-[1.2rem] font-semibold text-lp-navy tabular-nums">
                {doneCount} / {lessonCount}
              </span>
            </div>
            <LessonTicks states={lessonStates} className="mb-[18px]" />
            <GoldLink href={next.href}>
              <Play className="size-[13px] fill-current" strokeWidth={0} />
              {next.label}
            </GoldLink>
          </>
        ) : (
          <>
            <p className="font-lp-heading text-[2rem] font-semibold leading-none text-lp-navy tabular-nums">
              {priceTiyin > 0 ? formatTiyin(priceTiyin) : t("free")}
            </p>
            <p className="mb-[18px] mt-1.5 text-[.82rem] text-lp-muted">
              {priceTiyin > 0 ? t("oneTimePayment") : t("freeCourse")}
            </p>

            {!isAuthed ? (
              <GoldLink href="/login">{t("enrollCta")}</GoldLink>
            ) : providers.length > 0 ? (
              <div className="space-y-2">
                {providers.map((p, i) => (
                  <form key={p} action={startCheckoutAction.bind(null, courseId, p)}>
                    <button
                      type="submit"
                      className={cn(
                        "flex w-full items-center justify-center rounded-[11px] p-3.5 text-[.98rem] font-bold transition",
                        i === 0
                          ? "bg-lp-gold text-lp-navy-deep shadow-[0_6px_18px_rgba(248,184,1,.3)] hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(248,184,1,.4)]"
                          : "border-[1.5px] border-lp-line bg-white text-lp-navy hover:bg-lp-wash",
                      )}
                    >
                      {p === "click" ? t("payWithClick") : t("payWithPayme")}
                    </button>
                  </form>
                ))}
              </div>
            ) : process.env.NODE_ENV === "production" ? (
              // No provider configured on the live site: say so, rather than
              // offer the development free-enrol.
              <p className="rounded-[11px] border border-lp-line bg-lp-wash-alt p-3 text-center text-[.86rem] text-lp-slate">
                {t("paymentsSoon")}
              </p>
            ) : (
              <form action={devEnrollAction.bind(null, courseId)}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center rounded-[11px] bg-lp-gold p-3.5 text-[.98rem] font-bold text-lp-navy-deep"
                >
                  {t("enrollDev")}
                </button>
                <p className="mt-2 text-center text-[.74rem] text-lp-muted">{t("devEnrollNote")}</p>
              </form>
            )}

            {preview && (
              <Link
                href={`/learn/${courseId}/${preview.id}`}
                className="mt-3 block text-center text-[.86rem] font-bold text-lp-navy-mid hover:underline"
              >
                {t("previewCta")}
              </Link>
            )}
          </>
        )}

        <dl className="mt-5 border-t border-lp-line-soft text-[.86rem]">
          <Fact label={t("factLessons")} value={t("factLessonsValue", { count: lessonCount })} />
          {exam && (
            <Fact
              label={t("examTitle")}
              value={t("factExamValue", { count: exam.questions, pct: exam.threshold })}
            />
          )}
          <Fact label={t("factAccess")} value={t("factAccessValue", { days: accessDurationDays })} />
          <Fact label={t("factLanguage")} value={t("factLanguageValue")} last />
        </dl>
        {certificateEnabled && (
          <p className="mt-2.5 text-[.74rem] leading-normal text-lp-muted">{t("certDisclaimer")}</p>
        )}
      </div>
    </div>
  );
}

function GoldLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-[9px] rounded-[11px] bg-lp-gold p-3.5 text-[.98rem] font-bold text-lp-navy-deep shadow-[0_6px_18px_rgba(248,184,1,.3)] transition hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(248,184,1,.4)]"
    >
      {children}
    </Link>
  );
}

function Fact({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn("flex justify-between py-[11px]", !last && "border-b border-lp-line-soft")}>
      <dt className="text-lp-muted">{label}</dt>
      <dd className="font-semibold text-lp-ink tabular-nums">{value}</dd>
    </div>
  );
}

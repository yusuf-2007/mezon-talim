import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { getExamOverview, getResult } from "@/lib/assessments/service";
import { issueIfEligible } from "@/lib/certificates/service";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { getCurriculum } from "@/lib/learning/curriculum";
import { pickLocale } from "@/lib/i18n/localized";
import { APP_TIME_ZONE, cn } from "@/lib/utils";
import { Eyebrow, FocusBar, initialsOf } from "@/components/learn/flow-ui";
import type { Locale } from "@/lib/i18n/routing";

function fmtDuration(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The result of one attempt: the score, then either the certificate (pass) or
 * the way back in (fail), then every question marked right or wrong.
 *
 * On a fail the review says *which* answers were wrong and links each to its
 * module, but withholds the correct option until the student has passed (B16)
 * — otherwise the second attempt is a copy exercise.
 */
export default async function ExamResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const user = await requireUser();
  const [t, tPlayer] = await Promise.all([getTranslations("Exam"), getTranslations("Player")]);
  const locale = (await getLocale()) as Locale;

  const result = await getResult(attemptId, user.id);
  if (!result) notFound();
  const a = result.assessment;
  const isFinal = a.type === "final_exam";

  const [course, curriculum, overview] = await Promise.all([
    coursesRepository.findById(a.courseId),
    getCurriculum(a.courseId, user.id),
    getExamOverview(a.id, user.id),
  ]);
  if (!course) notFound();

  // A pass on the final exam issues the certificate (idempotent) and shows it.
  const certificate =
    result.passed && isFinal && result.isScored ? await issueIfEligible(user.id, a.courseId) : null;

  // Where a wrong answer sends the student back to: the module's first lesson.
  const moduleLink = new Map(
    curriculum.modules
      .filter((m) => m.lessons.length > 0)
      .map((m) => [m.id, { href: `/learn/${a.courseId}/${m.lessons[0].id}`, title: m.title }]),
  );

  const failed = result.isScored && !result.passed;
  const title = !result.isScored ? t("doneTitle") : result.passed ? t("passTitle") : t("failTitle");
  const sub = failed
    ? t("failSub", { pct: result.passThresholdPct })
    : certificate
      ? t("passSubFinal")
      : t("passSub");

  return (
    <>
      <FocusBar
        courseHref={`/courses/${course.slug}`}
        courseTitle={pickLocale(course.title, locale)}
        backLabel={tPlayer("backToCourse")}
        initials={initialsOf(user.fullName ?? user.email ?? user.phone)}
      />

      <div className="mx-auto max-w-[920px] px-5 pb-20 pt-11 sm:px-7">
        {/* ── Score ─────────────────────────────────────────────────── */}
        {/* Fail is a muted slate rather than red: it is a step, not an alarm. */}
        <section
          className={cn(
            "rounded-[18px] px-7 py-9 text-white sm:px-9",
            failed ? "bg-[#33475B]" : "bg-lp-navy",
          )}
        >
          <div className="grid items-center gap-8 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="mb-2.5 text-[.74rem] font-bold uppercase tracking-[.14em] text-lp-gold-light">
                {isFinal ? t("resultEyebrowFinal") : t("resultEyebrow")}
              </p>
              <h1 className="font-lp-heading text-[2.1rem] font-semibold leading-[1.15]">{title}</h1>
              <p className="mt-2.5 max-w-[48ch] text-[1.05rem] text-lp-on-navy">{sub}</p>
            </div>
            {result.isScored && (
              <div className="tabular-nums sm:text-right">
                <p
                  className={cn(
                    "font-lp-heading text-[4rem] font-semibold leading-none",
                    failed ? "text-lp-gold-light" : "text-white",
                  )}
                >
                  {result.scorePct}%
                </p>
                <p className="mt-1.5 text-[.85rem] text-lp-on-navy">
                  {t("thresholdLower", { pct: result.passThresholdPct })}
                </p>
              </div>
            )}
          </div>
          <div className="mt-7 grid grid-cols-3 border-t border-white/[.14] tabular-nums">
            <HeroStat value={`${result.correctCount} / ${result.totalCount}`} label={t("correctLower")} first />
            <HeroStat value={fmtDuration(result.timeSpentSeconds)} label={t("timeSpentLower")} />
            <HeroStat value={t("attemptN", { n: result.attemptNo })} label={t("attemptLower")} />
          </div>
        </section>

        {/* ── Certificate ───────────────────────────────────────────── */}
        {certificate && (
          <section className="mt-[22px] grid items-center gap-7 rounded-2xl border border-lp-line bg-lp-wash px-[26px] py-6 sm:grid-cols-[260px_1fr]">
            <CertificateThumb
              name={user.fullName ?? ""}
              course={pickLocale(course.title, locale)}
              word={t("certWord")}
            />
            <div>
              <Eyebrow className="mb-2">{t("certReady")}</Eyebrow>
              <h2 className="mb-2 font-lp-heading text-[1.3rem] font-semibold text-lp-navy">
                {t("certTitle")}
              </h2>
              <p className="mb-4 text-[.85rem] text-lp-slate">
                <span className="rounded-[5px] border border-lp-line bg-white px-2 py-0.5 font-mono text-lp-ink">
                  {certificate.verificationCode}
                </span>{" "}
                · {t("verifiedOnline")}
              </p>
              <div className="flex flex-wrap gap-2.5">
                <Link
                  href={`/verify/${certificate.verificationCode}`}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-lp-gold px-5 py-3 text-[.92rem] font-bold text-lp-navy-deep shadow-[0_6px_18px_rgba(248,184,1,.3)] transition hover:-translate-y-px"
                >
                  {t("viewCertificate")}
                </Link>
                <a
                  href={`/api/certificates/${certificate.verificationCode}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-[10px] border-[1.5px] border-lp-navy bg-white px-4 py-[11px] text-[.9rem] font-bold text-lp-navy transition-colors hover:bg-lp-wash"
                >
                  {t("downloadPdf")}
                </a>
              </div>
              <p className="mt-3 text-[.74rem] text-lp-muted">{t("certDisclaimer")}</p>
            </div>
          </section>
        )}

        {/* ── The way back in ───────────────────────────────────────── */}
        {failed && overview && <RetryBanner overview={overview} t={t} locale={locale} />}

        {/* ── Every question ────────────────────────────────────────── */}
        <section className="mt-[22px] overflow-hidden rounded-2xl border border-lp-line bg-white">
          <div className="flex items-center justify-between border-b border-lp-line-soft px-6 py-[18px]">
            <h2 className="font-lp-heading text-[1.2rem] font-semibold text-lp-navy">{t("analysisTitle")}</h2>
            <span className="text-[.82rem] text-lp-muted tabular-nums">
              {t("correctSummary", { correct: result.correctCount, total: result.totalCount })}
            </span>
          </div>
          {!result.reviewAllowed && (
            <p className="border-b border-lp-line-soft bg-lp-gold-wash px-6 py-3 text-[.85rem] text-lp-slate">
              {t("keyAfterPass")}
            </p>
          )}
          <ol>
            {result.answers.map((r, i) => {
              const link = r.moduleId ? moduleLink.get(r.moduleId) : undefined;
              const yours = r.yourLabels.map((l) => pickLocale(l, locale)).join(", ");
              return (
                <li
                  key={i}
                  className="grid grid-cols-[30px_1fr] gap-3.5 border-b border-lp-line-soft px-6 py-[18px] last:border-b-0"
                >
                  <span
                    className={cn(
                      "grid size-[26px] place-items-center rounded-full text-white",
                      r.correct ? "bg-lp-success-dot" : "bg-lp-danger",
                    )}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                      <path d={r.correct ? "M20 6 9 17l-5-5" : "M18 6 6 18M6 6l12 12"} />
                    </svg>
                    <span className="sr-only">{r.correct ? t("passedShort") : t("failedShort")}</span>
                  </span>
                  <div>
                    <p className="text-[.95rem] font-semibold leading-[1.45] text-lp-ink">
                      {i + 1}. {pickLocale(r.prompt, locale)}
                    </p>
                    <p className="mt-1.5 text-[.85rem] text-lp-slate">
                      {t("yourAnswerLabel")}{" "}
                      <b className={r.correct ? "text-lp-success" : "text-lp-danger"}>
                        {yours || t("noAnswer")}
                      </b>
                    </p>
                    {!r.correct && (r.correctLabels || link) && (
                      <p className="mt-0.5 text-[.85rem] text-lp-success">
                        {r.correctLabels && (
                          <>
                            {t("correctAnswerLabel")}{" "}
                            <b>{r.correctLabels.map((l) => pickLocale(l, locale)).join(", ")}</b>
                            {link && " · "}
                          </>
                        )}
                        {link && (
                          <Link href={link.href} className="font-bold text-lp-navy-mid hover:underline">
                            {pickLocale(link.title, locale)} →
                          </Link>
                        )}
                      </p>
                    )}
                    {r.explanation && pickLocale(r.explanation, locale) && (
                      <p className="mt-1.5 text-[.85rem] text-lp-muted">{pickLocale(r.explanation, locale)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="mt-[22px] text-center">
          <Link href={`/courses/${course.slug}`} className="text-[.9rem] font-bold text-lp-navy-mid hover:underline">
            {t("backToCoursePage")}
          </Link>
        </div>
      </div>
    </>
  );
}

function HeroStat({ value, label, first }: { value: string; label: string; first?: boolean }) {
  return (
    <div className={cn("pt-4", first ? "pr-5" : "border-l border-white/[.14] px-5")}>
      <p className="text-[1.2rem] font-bold">{value}</p>
      <p className="text-[.8rem] text-lp-on-navy-dim">{label}</p>
    </div>
  );
}

/** A small drawing of the certificate, not the certificate itself (that is the PDF). */
function CertificateThumb({ name, course, word }: { name: string; course: string; word: string }) {
  return (
    <div aria-hidden className="relative">
      <div className="relative aspect-[1.414] overflow-hidden rounded-md border-[1.5px] border-lp-navy bg-white px-3 py-4 text-center shadow-[0_10px_26px_rgba(2,58,105,.14)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-lp-navy to-lp-gold" />
        <p className="font-lp-heading text-[.66rem] font-semibold tracking-[.04em] text-lp-navy">
          MEZON <span className="text-lp-gold-deep">TAʼLIM</span>
        </p>
        <p className="mt-2.5 text-[.66rem] font-bold uppercase tracking-[.2em] text-lp-gold-deep">{word}</p>
        <p className="mt-1.5 truncate font-lp-heading text-[1.05rem] font-semibold text-lp-navy">{name}</p>
        <p className="mt-1 truncate text-[.66rem] text-lp-slate">{course}</p>
        <div className="mt-2.5 flex justify-center">
          <span className="size-5 rounded-full bg-lp-gold" />
        </div>
      </div>
      <span className="absolute -left-[7px] -top-[7px] size-[18px] border-l-2 border-t-2 border-lp-gold" />
      <span className="absolute -bottom-[7px] -right-[7px] size-[18px] border-b-2 border-r-2 border-lp-gold" />
    </div>
  );
}

type Overview = NonNullable<Awaited<ReturnType<typeof getExamOverview>>>;

/** What the student can do next after failing, in the service's own terms. */
function RetryBanner({
  overview: o,
  t,
  locale,
}: {
  overview: Overview;
  t: Awaited<ReturnType<typeof getTranslations<"Exam">>>;
  locale: Locale;
}) {
  if (o.alreadyPassed) return null;

  let headline: string;
  let action = t("retake");
  switch (o.blockedReason) {
    case "no_attempts_left":
      headline = t("retryNone");
      action = t("askAccess");
      break;
    case "cooldown":
      headline = t("retryCooldown", {
        time: o.cooldownUntil
          ? new Date(o.cooldownUntil).toLocaleString(
              locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ",
              { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE },
            )
          : "",
      });
      break;
    default:
      headline =
        o.attemptsLeft == null ? t("retryUnlimited") : t("retryLeft", { count: o.attemptsLeft });
  }

  return (
    <section className="mt-[22px] flex flex-wrap items-center justify-between gap-[18px] rounded-2xl border border-lp-gold-band bg-lp-gold-wash px-6 py-[22px]">
      <div>
        <p className="mb-1 font-bold text-lp-ink">{headline}</p>
        <p className="text-[.88rem] text-lp-slate">{t("retryHint")}</p>
      </div>
      <Link
        href={`/exam/${o.assessment.id}`}
        className="inline-flex items-center rounded-[10px] bg-lp-navy px-5 py-3 text-[.92rem] font-bold text-white transition-colors hover:bg-lp-navy-deep"
      >
        {action}
      </Link>
    </section>
  );
}

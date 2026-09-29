import { Check } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { getExamOverview } from "@/lib/assessments/service";
import { startExamAction } from "@/lib/assessments/actions";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { getCurriculum } from "@/lib/learning/curriculum";
import { buildFlow, minutesOf } from "@/lib/learning/flow";
import { pickLocale } from "@/lib/i18n/localized";
import { APP_TIME_ZONE, cn } from "@/lib/utils";
import { RequestAccessButton } from "@/components/exam/request-access-button";
import { Eyebrow, FocusBar, LessonTicks, initialsOf } from "@/components/learn/flow-ui";
import type { Locale } from "@/lib/i18n/routing";

type ExamT = Awaited<ReturnType<typeof getTranslations<"Exam">>>;
type Overview = NonNullable<Awaited<ReturnType<typeof getExamOverview>>>;

/**
 * The page before an exam: what it is, what it takes to sit it, and one
 * button — or, when it cannot be sat yet, a plain statement of why.
 *
 * Every blocked state the service knows about (lessons left, module tests
 * left, cooldown, out of attempts, not enrolled) gets its own sentence under
 * the same button, rather than the button disappearing and the student having
 * to work out what changed.
 */
export default async function PreExamPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  const user = await requireUser();
  const [t, tPlayer] = await Promise.all([getTranslations("Exam"), getTranslations("Player")]);
  const locale = (await getLocale()) as Locale;

  const o = await getExamOverview(assessmentId, user.id);
  if (!o) notFound();
  const a = o.assessment;
  const [course, curriculum] = await Promise.all([
    coursesRepository.findById(a.courseId),
    getCurriculum(a.courseId, user.id),
  ]);
  if (!course) notFound();

  const flow = buildFlow(curriculum);
  const isFinal = a.type === "final_exam";
  const minutes = minutesOf(a.timeLimitSeconds);
  const passedAttempt = o.history.find((h) => h.passed) ?? null;

  const eyebrow =
    a.type === "final_exam"
      ? t("eyebrowFinal")
      : a.type === "module_test"
        ? t("eyebrowModule")
        : a.type === "mock_exam"
          ? t("eyebrowMock")
          : t("eyebrowQuiz");

  return (
    <>
      <FocusBar
        courseHref={`/courses/${course.slug}`}
        courseTitle={pickLocale(course.title, locale)}
        backLabel={tPlayer("backToCourse")}
        initials={initialsOf(user.fullName ?? user.email ?? user.phone)}
        progress={{ done: curriculum.completedCount, total: curriculum.lessonCount }}
      />

      <div className="mx-auto max-w-[860px] px-5 pb-20 pt-11 sm:px-7">
        <Eyebrow className="mb-2">{eyebrow}</Eyebrow>
        <h1 className="font-lp-heading text-[clamp(1.9rem,3.4vw,2.6rem)] font-semibold leading-[1.14] text-lp-navy">
          {pickLocale(a.title, locale)}
        </h1>
        <p className="mt-2.5 max-w-[56ch] text-[1.05rem] text-lp-slate">
          {isFinal && a.isScored ? t("introFinal", { pct: a.passThresholdPct }) : t("introOther")}
        </p>

        {/* ── Facts ─────────────────────────────────────────────────── */}
        <div className="mt-7 grid grid-cols-2 overflow-hidden rounded-2xl border border-lp-line bg-white tabular-nums sm:grid-cols-4">
          <Stat value={String(o.questionCount)} label={t("statQuestionsLower")} />
          <Stat value={a.isScored ? `${a.passThresholdPct}%` : "—"} label={t("statPassLower")} />
          <Stat value={minutes ? t("minutesShort", { count: minutes }) : "∞"} label={t("statTimeLower")} />
          <Stat
            value={a.maxAttempts ? String(a.maxAttempts) : "∞"}
            label={t("statAttemptsLower")}
          />
        </div>

        {/* ── Already passed ────────────────────────────────────────── */}
        {o.alreadyPassed && passedAttempt && (
          <div className="mt-[22px] flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-[#BFE3CF] bg-lp-success-tint px-[22px] py-[18px]">
            <div className="flex items-center gap-3">
              <span className="grid size-[34px] place-items-center rounded-full bg-lp-success-dot text-white">
                <Check className="size-4" strokeWidth={3} />
              </span>
              <div>
                <p className="font-bold text-lp-success">
                  {t("passedBanner", { pct: passedAttempt.scorePct ?? 0 })}
                </p>
                <p className="text-[.86rem] text-[#2A6B4E] tabular-nums">
                  {fmtDate(passedAttempt.submittedAt, locale)} ·{" "}
                  {t("attemptN", { n: passedAttempt.attemptNo })}
                </p>
              </div>
            </div>
            <Link
              href={`/exam/attempt/${passedAttempt.id}/result`}
              className="text-[.88rem] font-bold text-lp-success hover:underline"
            >
              {t("resultAndCertificate")}
            </Link>
          </div>
        )}

        {/* ── Requirements ──────────────────────────────────────────── */}
        {o.prereq && (
          <section className="mt-[22px] rounded-2xl border border-lp-line bg-white px-6 py-[22px]">
            <Eyebrow className="mb-3">{t("prereqTitle")}</Eyebrow>
            <div className="space-y-4">
              <Requirement
                met={o.prereq.lessons.allComplete}
                label={t("reqLessons")}
                status={
                  o.prereq.lessons.allComplete
                    ? t("prereqMet")
                    : `${o.prereq.lessons.completed} / ${o.prereq.lessons.total}`
                }
              >
                <LessonTicks
                  states={flow.lessons.map((l) => l.state)}
                  height="sm"
                  className="mt-2 max-w-[220px]"
                />
              </Requirement>
              {o.prereq.moduleTests.total > 0 && (
                <Requirement
                  met={o.prereq.moduleTests.allPassed}
                  label={t("reqModuleTests")}
                  status={
                    o.prereq.moduleTests.allPassed
                      ? t("prereqMet")
                      : `${o.prereq.moduleTests.passed} / ${o.prereq.moduleTests.total}`
                  }
                />
              )}
            </div>
          </section>
        )}

        {/* ── Start ─────────────────────────────────────────────────── */}
        <div className="mt-[22px] flex flex-wrap items-center gap-4">
          <StartAction o={o} assessmentId={assessmentId} isFinal={isFinal} t={t} locale={locale} />
        </div>

        {/* ── Rules + history ───────────────────────────────────────── */}
        <div className="mt-8 grid gap-[22px] sm:grid-cols-2">
          <section className="rounded-2xl border border-lp-line bg-white px-6 py-[22px]">
            <Eyebrow className="mb-3">{t("rulesShort")}</Eyebrow>
            <ul className="text-[.9rem] leading-normal text-[#2A3B4C]">
              {[
                t("instrAnswerAll"),
                a.timeLimitSeconds ? t("instrTime") : null,
                t("instrAutosave"),
                a.maxAttempts ? t("instrRetry") : null,
              ]
                .filter(Boolean)
                .map((r, i, all) => (
                  <li
                    key={i}
                    className={cn("py-2.5", i < all.length - 1 && "border-b border-lp-line-soft")}
                  >
                    {r}
                  </li>
                ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-lp-line bg-white px-6 py-[22px]">
            <Eyebrow className="mb-3">{t("attemptHistory")}</Eyebrow>
            {o.history.length === 0 ? (
              <p className="text-[.88rem] leading-relaxed text-lp-muted">{t("noAttemptsYet")}</p>
            ) : (
              <ul>
                {o.history.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between border-b border-lp-line-soft py-2.5 text-[.9rem] tabular-nums last:border-b-0"
                  >
                    <Link href={`/exam/attempt/${h.id}/result`} className="text-lp-slate hover:underline">
                      {fmtDate(h.submittedAt, locale)} · {t("attemptN", { n: h.attemptNo })}
                    </Link>
                    <span className={cn("font-bold", h.passed ? "text-lp-success" : "text-lp-danger")}>
                      {h.scorePct ?? 0}% · {h.passed ? t("passedShort") : t("failedShort")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-lp-line-soft px-[22px] py-[18px] [&:not(:first-child)]:border-l max-sm:[&:nth-child(3)]:border-l-0 max-sm:[&:nth-child(n+3)]:border-t">
      <p className="font-lp-heading text-[1.9rem] font-semibold leading-none text-lp-navy">{value}</p>
      <p className="mt-1.5 text-[.8rem] text-lp-muted">{label}</p>
    </div>
  );
}

function Requirement({
  met,
  label,
  status,
  children,
}: {
  met: boolean;
  label: string;
  status: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "grid size-6 place-items-center rounded-full border-[1.5px]",
          met ? "border-lp-success-dot bg-lp-success-dot text-white" : "border-lp-line-strong text-lp-line-strong",
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
      <div>
        <p className="text-[.94rem] font-semibold text-lp-ink">{label}</p>
        {children}
      </div>
      <span className={cn("text-[.84rem] font-bold tabular-nums", met ? "text-lp-success" : "text-lp-muted")}>
        {status}
      </span>
    </div>
  );
}

const goldBtn =
  "inline-flex items-center gap-[9px] rounded-[11px] bg-lp-gold px-[26px] py-[15px] text-[.95rem] font-bold text-lp-navy-deep shadow-[0_6px_18px_rgba(248,184,1,.3)] transition hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(248,184,1,.4)] disabled:cursor-not-allowed disabled:opacity-60";
const greyBtn =
  "inline-flex cursor-not-allowed items-center gap-[9px] rounded-[11px] bg-lp-line-soft px-[26px] py-[15px] text-[.95rem] font-bold text-lp-muted";

function StartAction({
  o,
  assessmentId,
  isFinal,
  t,
  locale,
}: {
  o: Overview;
  assessmentId: string;
  isFinal: boolean;
  t: ExamT;
  locale: Locale;
}) {
  const minutes = minutesOf(o.assessment.timeLimitSeconds);
  const note = (text: string) => <span className="text-[.86rem] text-lp-muted">{text}</span>;

  // Startable, or already running.
  if (!o.blockedReason) {
    return (
      <>
        <form action={startExamAction.bind(null, assessmentId)}>
          <button type="submit" disabled={o.questionCount === 0} className={goldBtn}>
            {o.inProgress ? t("resume") : isFinal ? t("startFinalExam") : t("start")}
          </button>
        </form>
        {note(minutes ? t("readyHintTimed", { minutes }) : t("readyHint"))}
      </>
    );
  }

  switch (o.blockedReason) {
    case "already_passed":
      return null; // the green banner above already says it, with the link.
    case "no_attempts_left":
      return (
        <>
          <RequestAccessButton assessmentId={assessmentId} alreadyRequested={o.retryRequested} />
          {note(t("noAttemptsNote"))}
        </>
      );
    case "lessons_incomplete": {
      const left = o.prereq ? o.prereq.lessons.total - o.prereq.lessons.completed : 0;
      return (
        <>
          <span className={greyBtn}>{t("lessonsLeft", { count: left })}</span>
          {note(t("blocked_lessons_incomplete"))}
        </>
      );
    }
    case "cooldown":
      return (
        <>
          <span className={greyBtn}>{t("start")}</span>
          {note(
            t("blocked_cooldown", {
              time: o.cooldownUntil ? fmtDateTime(o.cooldownUntil, locale) : "",
            }),
          )}
        </>
      );
    default:
      return (
        <>
          <span className={greyBtn}>{isFinal ? t("startFinalExam") : t("start")}</span>
          {note(t(`blocked_${o.blockedReason}`))}
        </>
      );
  }
}

function dateLocale(locale: Locale) {
  return locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ";
}
function fmtDate(ms: number, locale: Locale) {
  return new Date(ms).toLocaleDateString(dateLocale(locale), { timeZone: APP_TIME_ZONE });
}
function fmtDateTime(ms: number, locale: Locale) {
  return new Date(ms).toLocaleString(dateLocale(locale), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });
}

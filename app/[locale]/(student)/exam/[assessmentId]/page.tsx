import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getExamOverview } from "@/lib/assessments/service";
import { startExamAction } from "@/lib/assessments/actions";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { pickLocale } from "@/lib/i18n/localized";
import { Button } from "@/components/ui/button";
import { CoursePlayerShell } from "@/components/player/course-player-shell";
import { RequestAccessButton } from "@/components/exam/request-access-button";
import type { Locale } from "@/lib/i18n/routing";

export default async function PreExamPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  const user = await requireUser();
  const t = await getTranslations("Exam");
  const locale = (await getLocale()) as Locale;

  const o = await getExamOverview(assessmentId, user.id);
  if (!o) notFound();
  const a = o.assessment;
  const [modules, course] = await Promise.all([
    modulesRepository.listByCourse(a.courseId),
    coursesRepository.findById(a.courseId),
  ]);
  const moduleCount = modules.length;

  const dateLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";
  const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(dateLocale);
  const cooldownText = o.cooldownUntil
    ? new Date(o.cooldownUntil).toLocaleString(dateLocale)
    : "";

  const stats = [
    { label: t("statQuestions"), value: String(o.questionCount) },
    {
      label: t("statPass"),
      value: a.isScored ? `${a.passThresholdPct}%` : "—",
    },
    {
      label: t("statTime"),
      value: a.timeLimitSeconds
        ? `${Math.round(a.timeLimitSeconds / 60)}′`
        : "∞",
    },
    { label: t("statModules"), value: String(moduleCount) },
  ];

  const body = (
    <section className="mx-auto max-w-2xl">
      <p className="text-sm text-slate-500">{t("examTitle")}</p>
      <h1 className="mt-1 font-heading text-3xl font-semibold text-navy-800">
        {pickLocale(a.title, locale)}
      </h1>

      {/* 4-stat grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-line bg-surface p-4 text-center shadow-sm"
          >
            <div className="font-heading text-2xl font-semibold text-navy-800 tabular-nums">
              {s.value}
            </div>
            <div className="mt-1 text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Prerequisites (final exam only) */}
      {o.prereq && (
        <div className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-medium text-navy-800">{t("prereqTitle")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <PrereqRow
              met={o.prereq.lessons.allComplete}
              label={t("prereqLessons", {
                done: o.prereq.lessons.completed,
                total: o.prereq.lessons.total,
              })}
              metLabel={t("prereqMet")}
              unmetLabel={t("prereqUnmet")}
            />
            {o.prereq.moduleTests.total > 0 && (
              <PrereqRow
                met={o.prereq.moduleTests.allPassed}
                label={t("prereqModuleTests", {
                  done: o.prereq.moduleTests.passed,
                  total: o.prereq.moduleTests.total,
                })}
                metLabel={t("prereqMet")}
                unmetLabel={t("prereqUnmet")}
              />
            )}
          </ul>
        </div>
      )}

      {/* Your progress (only after attempts) */}
      {o.history.length > 0 && (
        <div className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-navy-800">{t("yourProgress")}</h2>
            <span className="text-sm text-slate-500">
              {o.attemptsLeft == null
                ? t("attemptsUsed", { used: o.attemptsUsed, allowed: "∞" })
                : t("attemptsUsed", {
                    used: o.attemptsUsed,
                    allowed: o.attemptsUsed + o.attemptsLeft,
                  })}
            </span>
          </div>
          {o.bestScorePct != null && (
            <p className="mt-1 text-sm text-slate-500">
              {t("bestScore", { pct: o.bestScorePct })}
            </p>
          )}
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("attemptHistory")}
            </p>
            <ul className="divide-y divide-line text-sm">
              {o.history.map((h) => (
                <li key={h.attemptNo} className="flex items-center justify-between py-1.5">
                  <span className="tabular-nums text-slate-500">
                    {fmtDate(h.submittedAt)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-ink">{h.scorePct ?? 0}%</span>
                    <span
                      className={
                        h.passed
                          ? "font-medium text-success"
                          : "font-medium text-danger"
                      }
                    >
                      {h.passed ? t("passed") : t("failed")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 rounded-xl border border-success/30 bg-success/5 p-5">
        <h2 className="font-medium text-navy-800">{t("instructionsTitle")}</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          <li>• {t("instrAnswerAll")}</li>
          {a.isScored && <li>• {t("instrOverall", { pct: a.passThresholdPct })}</li>}
          {a.timeLimitSeconds != null && <li>• {t("instrTime")}</li>}
          <li>• {t("instrRetry")}</li>
          <li>• {t("instrAutosave")}</li>
        </ul>
      </div>

      {/* Action — 5 states (spec 2.2) */}
      <div className="mt-8">
        <ExamAction
          o={o}
          assessmentId={assessmentId}
          t={t}
          cooldownText={cooldownText}
        />
      </div>
    </section>
  );

  // Final exams live inside the course-player shell (sidebar stays); other
  // assessment types render standalone.
  if (a.type === "final_exam" && course) {
    return (
      <CoursePlayerShell
        courseId={a.courseId}
        courseSlug={course.slug}
        userId={user.id}
        activeLessonId="exam"
      >
        {body}
      </CoursePlayerShell>
    );
  }
  return <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">{body}</div>;
}

function PrereqRow({
  met,
  label,
  metLabel,
  unmetLabel,
}: {
  met: boolean;
  label: string;
  metLabel: string;
  unmetLabel: string;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] text-white ${
          met ? "bg-success" : "bg-line"
        }`}
        aria-hidden
      >
        {met ? "✓" : ""}
      </span>
      <span className={met ? "text-ink" : "text-slate-500"}>{label}</span>
      <span className={`ml-auto text-xs ${met ? "text-success" : "text-slate-400"}`}>
        {met ? metLabel : unmetLabel}
      </span>
    </li>
  );
}

function ExamAction({
  o,
  assessmentId,
  t,
  cooldownText,
}: {
  o: NonNullable<Awaited<ReturnType<typeof getExamOverview>>>;
  assessmentId: string;
  t: Awaited<ReturnType<typeof getTranslations<"Exam">>>;
  cooldownText: string;
}) {
  // (a) In progress or freely startable → Start / Resume.
  if (!o.blockedReason) {
    return (
      <form action={startExamAction.bind(null, assessmentId)}>
        <Button type="submit" size="lg" disabled={o.questionCount === 0}>
          {o.inProgress ? t("resume") : t("start")}
        </Button>
      </form>
    );
  }
  // (b) Out of attempts, not passed → request access.
  if (o.blockedReason === "no_attempts_left") {
    return (
      <RequestAccessButton
        assessmentId={assessmentId}
        alreadyRequested={o.retryRequested}
      />
    );
  }
  // (c) Locked / cooldown / other → informational badge, no start.
  return (
    <p className="rounded-lg bg-gold-100 px-4 py-3 text-sm text-navy-800">
      {o.blockedReason === "cooldown"
        ? t("blocked_cooldown", { time: cooldownText })
        : t(`blocked_${o.blockedReason}`)}
    </p>
  );
}

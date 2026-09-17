import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { attemptsRepository } from "@/lib/db/repositories/attempts";
import { pickLocale } from "@/lib/i18n/localized";
import { APP_TIME_ZONE, cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  Card,
  CardHead,
  Empty,
  GhostLink,
  KpiStrip,
  Pill,
  StatusDot,
  Table,
} from "@/components/admin/ui";
import type { Locale } from "@/lib/i18n/routing";

const WINDOW_DAYS = 30;

/**
 * Final exams: how they are performing, and which questions are doing the
 * failing.
 *
 * Replaces a ComingSoon stub. The exam data has been accumulating since the
 * assessment system shipped and nothing read it in aggregate, so "is this exam
 * too hard" was unanswerable without SQL.
 */
export default async function AdminQuizzesPage() {
  const me = await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;

  const [stats, exams, hardest, recent] = await Promise.all([
    attemptsRepository.examStats(WINDOW_DAYS),
    attemptsRepository.byAssessment("final_exam"),
    attemptsRepository.hardestQuestions(5),
    attemptsRepository.recentWithContext(10),
  ]);

  const passRate =
    stats.attempts > 0 ? Math.round((stats.passed / stats.attempts) * 100) : 0;
  const firstTryRate =
    stats.passed > 0 ? Math.round((stats.firstTry / stats.passed) * 100) : 0;

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navQuizzes")}
        title={t("quizzesTitle")}
        userId={me.id}
        role={me.role}
      />

      <div className="mb-[18px]">
        <KpiStrip
          cells={[
            {
              label: t("examAttempts"),
              value: String(stats.attempts),
              sub: t("examWindow", { days: WINDOW_DAYS }),
            },
            {
              label: t("examPassRate"),
              value: `${passRate}%`,
              sub: t("examFirstTry", { pct: firstTryRate }),
            },
            { label: t("examAvgScore"), value: `${stats.avgScore}%` },
            {
              label: t("examHardQuestions"),
              value: String(hardest.filter((h) => Number(h.correctPct) < 50).length),
              tone: hardest.some((h) => Number(h.correctPct) < 50) ? "red" : undefined,
            },
          ]}
        />
      </div>

      <div className="mb-[18px] grid gap-[18px] xl:grid-cols-2">
        <Card>
          <CardHead title={t("examListTitle")} />
          {exams.length === 0 ? (
            <Empty>{t("noData")}</Empty>
          ) : (
            <ul>
              {exams.map((e) => {
                const passed = Number(e.passed);
                const failed = Number(e.failed);
                const total = passed + failed;
                return (
                  <li
                    key={e.assessmentId}
                    className="border-b border-lp-line-soft px-6 py-5 last:border-b-0"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-lp-heading text-[1.05rem] font-semibold text-lp-navy">
                        {pickLocale(e.courseTitle, locale)}
                      </p>
                      <Pill tone={e.isPublished ? "green" : "grey"}>
                        {e.isPublished ? t("status_published") : t("status_draft")}
                      </Pill>
                    </div>
                    <p className="mb-3 text-[.82rem] text-lp-muted">
                      {t("examSpec", {
                        pct: e.passThresholdPct,
                        attempts: e.maxAttempts ?? 0,
                        minutes: e.timeLimitSeconds
                          ? Math.round(e.timeLimitSeconds / 60)
                          : 0,
                      })}
                    </p>
                    {/* Pass and fail as one bar: the ratio is the point, and two
                        separate numbers make the reader do the division. */}
                    <span className="flex h-2 overflow-hidden rounded-full bg-lp-line-soft">
                      <span
                        className="bg-lp-success-dot"
                        style={{ width: total ? `${(passed / total) * 100}%` : "0%" }}
                      />
                      <span
                        className="bg-lp-danger"
                        style={{ width: total ? `${(failed / total) * 100}%` : "0%" }}
                      />
                    </span>
                    <p className="mt-2 flex flex-wrap gap-4 text-[.82rem] tabular-nums">
                      <span className="text-lp-success">
                        {t("examPassed", { count: passed })}
                      </span>
                      <span className="text-lp-danger">
                        {t("examFailed", { count: failed })}
                      </span>
                      <GhostLink href={`/admin/courses/${e.courseId}/assessments`}>
                        {t("examQuestionBank")}
                      </GhostLink>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title={t("hardestTitle")} />
          {hardest.length === 0 ? (
            <Empty>{t("hardestEmpty")}</Empty>
          ) : (
            <ul>
              {hardest.map((h) => {
                const pct = Number(h.correctPct);
                return (
                  <li
                    key={h.questionId}
                    className="grid grid-cols-[3rem_1fr] items-start gap-4 border-b border-lp-line-soft px-6 py-4 last:border-b-0"
                  >
                    <span
                      className={cn(
                        "font-lp-heading text-[1.2rem] font-semibold tabular-nums",
                        pct < 35
                          ? "text-lp-danger"
                          : pct < 50
                            ? "text-lp-gold-ink"
                            : "text-lp-navy",
                      )}
                    >
                      {pct}%
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[.88rem] leading-snug text-lp-ink">
                        {pickLocale(h.prompt, locale)}
                      </span>
                      <span className="mt-1 block truncate text-[.8rem] text-lp-muted">
                        {pickLocale(h.assessmentTitle, locale)} ·{" "}
                        {t("hardestAnswers", { count: Number(h.answers) })}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-lp-line-soft bg-lp-wash-alt px-6 py-4">
            <p className="text-[.8rem] text-lp-muted">{t("hardestNote")}</p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title={t("recentAttemptsTitle")} />
        <Table
          empty={t("noData")}
          head={[
            { label: t("colWhen") },
            { label: t("colStudent") },
            { label: t("colExam"), hide: true },
            { label: t("colScore"), align: "right" },
            { label: t("colTimeSpent"), hide: true, align: "right" },
            { label: t("colResult") },
          ]}
          rows={recent.map((a) => [
            <span key="w" className="whitespace-nowrap text-[.84rem] text-lp-slate tabular-nums">
              {a.submittedAt ? fmt(a.submittedAt, locale) : "—"}
            </span>,
            <span key="s" className="block min-w-0">
              <span className="block truncate font-semibold text-lp-ink">
                {a.userName || "—"}
              </span>
              <span className="block text-[.8rem] text-lp-muted">
                {t("examAttemptNo", { n: a.attemptNo })}
              </span>
            </span>,
            <span key="e" className="block min-w-0 truncate text-[.86rem] text-lp-slate">
              {pickLocale(a.assessmentTitle, locale)}
            </span>,
            <span
              key="sc"
              className={cn(
                "font-semibold",
                a.passed ? "text-lp-success" : "text-lp-danger",
              )}
            >
              {a.scorePct ?? 0}%
            </span>,
            <span key="t" className="text-[.84rem] text-lp-slate">
              {a.submittedAt ? minutes(a.startedAt, a.submittedAt) : "—"}
            </span>,
            a.passed ? (
              <StatusDot key="r" tone="green">
                {t("examResultPassed")}
              </StatusDot>
            ) : (
              <StatusDot key="r" tone="red">
                {t("examResultFailed")}
              </StatusDot>
            ),
          ])}
        />
      </Card>
    </>
  );
}

function minutes(from: Date, to: Date) {
  const m = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  return `${m}′`;
}

function fmt(d: Date, locale: Locale) {
  return new Date(d).toLocaleString(
    locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ",
    {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: APP_TIME_ZONE,
    },
  );
}

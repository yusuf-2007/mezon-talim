import { getLocale, getTranslations } from "next-intl/server";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { minutesOf, type FlowModule } from "@/lib/learning/flow";
import type { FinalExamBox } from "@/lib/assessments/service";
import { Eyebrow, LessonTicks, StateDot } from "./flow-ui";

/**
 * The curriculum beside the video: where you are, what is done, what is
 * locked, and the exam as the last step.
 *
 * The lesson being watched gets the gold edge, not the "current" lesson — a
 * student rewatching lesson 1 should see lesson 1 highlighted, while the dot
 * still says lesson 3 is where they are up to.
 */
export async function CourseRail({
  courseId,
  modules,
  activeLessonId,
  done,
  total,
  exam,
}: {
  courseId: string;
  modules: FlowModule[];
  activeLessonId: string | null;
  done: number;
  total: number;
  exam: FinalExamBox | null;
}) {
  const [t, locale] = await Promise.all([getTranslations("Player"), getLocale()]);
  const states = modules.flatMap((m) => m.lessons.map((l) => l.state));

  return (
    <aside className="overflow-hidden rounded-2xl border border-lp-line bg-white shadow-[0_2px_10px_rgba(2,58,105,.05)] lg:sticky lg:top-[84px]">
      <div className="border-b border-lp-line-soft px-5 pb-3.5 pt-[18px]">
        <div className="mb-2.5 flex items-baseline justify-between">
          <Eyebrow>{t("railTitle")}</Eyebrow>
          <span className="text-[.8rem] font-bold text-lp-slate tabular-nums">
            {done} / {total}
          </span>
        </div>
        <LessonTicks states={states} height="sm" />
      </div>

      {modules.map((m) => (
        <div key={m.id}>
          <p className="px-5 pb-1.5 pt-3 text-[.8rem] font-bold text-lp-muted">
            {pickLocale(m.title, locale)}
          </p>
          <ul>
            {m.lessons.map((l) => {
              const active = l.id === activeLessonId;
              const meta = {
                done: t("railDone"),
                current: t("railNext"),
                preview: t("railPreview"),
                locked: t("railLocked"),
              }[l.state];
              const row = (
                <span
                  className={cn(
                    "grid grid-cols-[26px_1fr] items-center gap-3 border-l-[3px] px-5 py-[11px]",
                    active ? "border-l-lp-gold bg-lp-gold-wash" : "border-l-transparent",
                  )}
                >
                  <StateDot state={l.state} size="sm" />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block truncate text-[.88rem]",
                        l.state === "locked" ? "font-medium text-lp-muted" : "font-bold text-lp-ink",
                      )}
                    >
                      {pickLocale(l.title, locale)}
                    </span>
                    <span className="block text-[.74rem] text-lp-muted">{meta}</span>
                  </span>
                </span>
              );
              return (
                <li key={l.id}>
                  {l.openable ? (
                    <Link
                      href={`/learn/${courseId}/${l.id}`}
                      aria-current={active ? "page" : undefined}
                      className="block transition-colors hover:bg-lp-wash"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div title={t("locked")}>{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {exam && <RailExamCard exam={exam} t={t} />}
    </aside>
  );
}

function RailExamCard({
  exam,
  t,
}: {
  exam: FinalExamBox;
  t: Awaited<ReturnType<typeof getTranslations<"Player">>>;
}) {
  const minutes = minutesOf(exam.timeLimitSeconds);
  const spec = [
    t("railExamQuestions", { count: exam.questionCount }),
    minutes ? t("railExamMinutes", { count: minutes }) : null,
    `${exam.passThresholdPct}%`,
  ]
    .filter(Boolean)
    .join(" · ");

  const status = {
    locked: {
      text: t("railExamLocked", { done: exam.lessonsDone, total: exam.lessonsTotal }),
      cls: "text-lp-muted",
      card: "border-lp-line bg-white",
    },
    ready: {
      text: exam.attempted ? t("railExamRetry") : t("railExamReady"),
      cls: "text-lp-gold-deep",
      card: "border-lp-gold bg-lp-gold-wash",
    },
    passed: {
      text: t("railExamPassed", { pct: exam.bestScorePct ?? 0 }),
      cls: "text-lp-success",
      card: "border-[#BFE3CF] bg-[#F2FAF6]",
    },
    needs_approval: {
      text: t("railExamApproval"),
      cls: "text-lp-danger",
      card: "border-lp-danger-line bg-lp-danger-tint",
    },
  }[exam.state];

  const inner = (
    <>
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-lp-heading text-[1.05rem] font-semibold text-lp-navy">
          {t("railExamTitle")}
        </span>
        <span className="text-[.66rem] font-extrabold uppercase tracking-[.1em] text-lp-gold-ink">
          {t("railExamLastStep")}
        </span>
      </span>
      <span className="block text-[.8rem] text-lp-slate tabular-nums">{spec}</span>
      <span className={cn("mt-2 block text-[.8rem] font-bold", status.cls)}>{status.text}</span>
    </>
  );
  const cls = cn("m-3.5 mt-3 block rounded-xl border-[1.5px] p-3.5", status.card);

  return exam.state === "locked" ? (
    <div className={cls}>{inner}</div>
  ) : (
    <Link href={`/exam/${exam.assessmentId}`} className={cn(cls, "transition-colors hover:brightness-[.98]")}>
      {inner}
    </Link>
  );
}

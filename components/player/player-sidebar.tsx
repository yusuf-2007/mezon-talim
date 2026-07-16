import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { pickLocale } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils";
import type { Curriculum } from "@/lib/learning/curriculum";
import type { FinalExamBox } from "@/lib/assessments/service";

/** Curriculum rail with progress checkmarks + sequential lock (Coursera-style). */
export async function PlayerSidebar({
  courseId,
  curriculum,
  activeLessonId,
  examBox,
  examActive = false,
}: {
  courseId: string;
  curriculum: Curriculum;
  activeLessonId: string;
  examBox: FinalExamBox | null;
  examActive?: boolean;
}) {
  const locale = await getLocale();
  const t = await getTranslations("Course");
  const tExam = await getTranslations("Exam");
  const pct =
    curriculum.lessonCount > 0
      ? Math.round((curriculum.completedCount / curriculum.lessonCount) * 100)
      : 0;

  return (
    <nav className="flex h-full flex-col">
      <div className="border-b border-line p-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-navy-100">
          <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500 tabular-nums">
          {curriculum.completedCount}/{curriculum.lessonCount} · {pct}%
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {curriculum.modules.map((m, i) => (
          <div key={m.id} className="border-b border-line">
            <p className="px-4 pt-4 pb-1 font-heading text-sm font-semibold text-navy-800">
              <span className="mr-1.5 tabular-nums text-slate-500">{i + 1}.</span>
              {pickLocale(m.title, locale)}
            </p>
            <ul className="pb-2">
              {m.lessons.map((lesson) => {
                const active = lesson.id === activeLessonId;
                const icon = lesson.completed ? "✓" : lesson.accessible ? "▷" : "🔒";
                const content = (
                  <div
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2 text-sm",
                      active && "bg-navy-100",
                      lesson.accessible ? "text-ink" : "text-slate-500",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                        lesson.completed
                          ? "bg-success text-white"
                          : "border border-line",
                      )}
                      aria-hidden
                    >
                      {icon}
                    </span>
                    <span className="line-clamp-2">{pickLocale(lesson.title, locale)}</span>
                  </div>
                );
                return (
                  <li key={lesson.id}>
                    {lesson.accessible ? (
                      <Link href={`/learn/${courseId}/${lesson.id}`} className="block hover:bg-bg">
                        {content}
                      </Link>
                    ) : (
                      <div title={t("locked")}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Terminal final-exam box (spec 3.2) — the last item after all modules.
            The whole card links to the exam page in every state except `locked`
            (the student genuinely can't enter it yet). */}
        {examBox && (
          <div className="p-4">
            <ExamBoxCard
              examBox={examBox}
              locale={locale}
              tExam={tExam}
              active={examActive}
            />
          </div>
        )}
      </div>
    </nav>
  );
}

/**
 * Terminal final-exam card. Clickable (links to the exam page) in every state
 * except `locked`, where it stays greyed and inert because the student can't
 * enter the exam yet. The status row communicates: passed / not passed /
 * not taken / retry-needs-approval / locked-with-lesson-hint.
 */
function ExamBoxCard({
  examBox,
  locale,
  tExam,
  active = false,
}: {
  examBox: FinalExamBox;
  locale: string;
  tExam: Awaited<ReturnType<typeof getTranslations<"Exam">>>;
  active?: boolean;
}) {
  const locked = examBox.state === "locked";
  // "Live" = clickable + gold-accented; locked = muted + inert.
  const accent = !locked;

  const statusRow = (() => {
    switch (examBox.state) {
      case "passed":
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold text-success">
            ✓ {tExam("examPassed")}
            {examBox.bestScorePct != null && (
              <span className="tabular-nums opacity-80">· {examBox.bestScorePct}%</span>
            )}
          </span>
        );
      case "needs_approval":
        // Took it, failed, out of attempts → still clickable to request access.
        return (
          <span className="inline-flex items-center gap-1.5 font-medium text-danger">
            ✗ {tExam("examNotPassed")}
          </span>
        );
      case "ready":
        return examBox.attempted ? (
          // Failed but has attempts left → retry.
          <span className="inline-flex items-center gap-1.5 font-semibold text-gold-500">
            ↻ {tExam("examRetry")}
            {examBox.bestScorePct != null && (
              <span className="tabular-nums opacity-80">· {examBox.bestScorePct}%</span>
            )}
          </span>
        ) : (
          // Never taken → start.
          <span className="inline-flex items-center gap-1.5 font-semibold text-gold-500">
            ▷ {tExam("startFinalExam")}
          </span>
        );
      case "locked":
        return (
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            🔒{" "}
            {tExam("unlockHint", {
              done: examBox.lessonsDone,
              total: examBox.lessonsTotal,
            })}
          </span>
        );
    }
  })();

  const inner = (
    <div
      className={cn(
        "relative rounded-xl border p-4 transition-colors",
        accent
          ? "border-gold-400 bg-gold-100/50 hover:bg-gold-100"
          : "border-line bg-bg",
        active && "ring-2 ring-navy-800 ring-offset-1",
      )}
    >
      <span className="absolute right-3 top-3 text-[9px] font-bold uppercase tracking-wider text-gold-500">
        {tExam("finalStep")}
      </span>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-bold",
            accent ? "bg-navy-900 text-gold-100" : "bg-line text-slate-500",
          )}
          aria-hidden
        >
          Q
        </span>
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold text-navy-800">
            {pickLocale(examBox.title, locale)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {tExam("questionsCount", { count: examBox.questionCount })} ·{" "}
            {tExam("threshold", { pct: examBox.passThresholdPct })}
          </p>
        </div>
      </div>
      <div className="mt-3 text-sm">{statusRow}</div>
    </div>
  );

  if (locked) return inner;
  return (
    <Link href={`/exam/${examBox.assessmentId}`} className="block">
      {inner}
    </Link>
  );
}

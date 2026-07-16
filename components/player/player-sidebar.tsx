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
}: {
  courseId: string;
  curriculum: Curriculum;
  activeLessonId: string;
  examBox: FinalExamBox | null;
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

        {/* Terminal final-exam box (spec 3.2) — the last item after all modules. */}
        {examBox && (
          <div className="p-4">
            <div
              className={cn(
                "relative rounded-xl border p-4",
                examBox.state === "locked" || examBox.state === "needs_approval"
                  ? "border-line bg-bg"
                  : "border-gold-400 bg-gold-100/50",
              )}
            >
              <span className="absolute right-3 top-3 text-[9px] font-bold uppercase tracking-wider text-gold-500">
                {tExam("finalStep")}
              </span>
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-bold",
                    examBox.state === "locked" ||
                      examBox.state === "needs_approval"
                      ? "bg-line text-slate-500"
                      : "bg-navy-900 text-gold-100",
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

              <div className="mt-3 text-sm">
                {examBox.state === "ready" && (
                  <Link
                    href={`/exam/${examBox.assessmentId}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-gold-500 hover:underline"
                  >
                    ▷ {tExam("startFinalExam")}
                  </Link>
                )}
                {examBox.state === "passed" && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-success">
                    ✓ {tExam("examPassed")}
                  </span>
                )}
                {examBox.state === "locked" && (
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    🔒{" "}
                    {tExam("unlockHint", {
                      done: examBox.lessonsDone,
                      total: examBox.lessonsTotal,
                    })}
                  </span>
                )}
                {examBox.state === "needs_approval" && (
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    🔒 {tExam("retryNeedsApproval")}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

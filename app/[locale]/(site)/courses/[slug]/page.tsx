import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { questionsRepository } from "@/lib/db/repositories/questions";
import { usersRepository } from "@/lib/db/repositories/users";
import { getCurrentUser } from "@/lib/auth";
import { getCurriculum } from "@/lib/learning/curriculum";
import { getFinalExamBox } from "@/lib/assessments/service";
import { buildFlow, minutesOf, type FlowLesson } from "@/lib/learning/flow";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { Eyebrow, ModuleAccordion, StateDot, initialsOf } from "@/components/learn/flow-ui";
import { EnrollCard } from "@/components/catalog/enroll-card";
import type { Locale } from "@/lib/i18n/routing";

/**
 * The public course page, and the one enrolled students come back to.
 *
 * It answers two different people with the same layout. Someone deciding
 * whether to buy sees the price and the path; someone halfway through sees
 * where they are on that path and one button to carry on. The path itself is
 * identical for both, which is the point — what you are buying is exactly what
 * you will walk through.
 */
export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);
  const loc = locale as Locale;
  const t = await getTranslations("Course");

  const course = await coursesRepository.findBySlug(slug);
  if (!course || course.status !== "published") notFound();

  const user = await getCurrentUser();
  const [curriculum, finalExam, instructor] = await Promise.all([
    getCurriculum(course.id, user?.id ?? null),
    assessmentsRepository.findByTypeForCourse(course.id, "final_exam"),
    course.createdBy ? usersRepository.findById(course.createdBy) : Promise.resolve(null),
  ]);
  const exam = finalExam?.isPublished ? finalExam : null;
  const [examQuestions, examBox] = await Promise.all([
    exam ? questionsRepository.countByAssessment(exam.id) : Promise.resolve(0),
    exam && user && curriculum.enrolled
      ? getFinalExamBox(course.id, user.id)
      : Promise.resolve(null),
  ]);

  const flow = buildFlow(curriculum);
  const threshold = exam?.passThresholdPct ?? course.passThresholdPct;
  const examMinutes = minutesOf(exam?.timeLimitSeconds);
  const title = pickLocale(course.title, loc);
  const { prose, outcomes } = splitDescription(pickLocale(course.description, loc));
  const previewLesson = flow.lessons.find((l) => l.state === "preview") ?? null;
  const resume = flow.lessons.find((l) => l.state === "current") ?? null;

  const examSpec = [
    t("examQuestions", { count: examQuestions }),
    examMinutes ? t("examMinutes", { count: examMinutes }) : null,
    t("examThreshold", { pct: threshold }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="bg-lp-wash-alt font-lp-body">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="bg-lp-navy">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 pb-16 pt-11 sm:px-12 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <p className="mb-[26px] text-[.82rem] text-lp-on-navy-dim">
              <Link href="/catalog" className="transition-colors hover:text-white">
                {t("breadcrumbCourses")}
              </Link>
              <span aria-hidden className="mx-1.5">
                /
              </span>
              <span className="text-[#DCE6F0]">{title}</span>
            </p>
            <p className="mb-4 flex items-center gap-2.5">
              <span aria-hidden className="h-0.5 w-[26px] bg-lp-gold" />
              <span className="text-[.74rem] font-bold uppercase tracking-[.14em] text-lp-gold-light">
                {[course.category, t("taughtIn")].filter(Boolean).join(" · ")}
              </span>
            </p>
            <h1 className="max-w-[18ch] font-lp-heading text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-.02em] text-white">
              {title}
            </h1>
            {course.summary && (
              <p className="mt-4 max-w-[52ch] text-[1.05rem] leading-relaxed text-lp-on-navy">
                {pickLocale(course.summary, loc)}
              </p>
            )}
            <dl className="mt-[30px] flex max-w-[620px] flex-wrap border-t border-white/[.14] tabular-nums">
              <HeroStat value={String(curriculum.lessonCount)} label={t("statLessons")} first />
              <HeroStat value={String(flow.modules.length)} label={t("statModules")} />
              {exam && <HeroStat value={`${threshold}%`} label={t("statThreshold")} />}
              <HeroStat value={String(course.accessDurationDays)} label={t("statAccessDays")} />
            </dl>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1200px] items-start gap-12 px-5 pb-20 sm:px-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <main className="min-w-0 lg:pt-12">
          {/* ── About ─────────────────────────────────────────────────── */}
          {(prose.length > 0 || outcomes.length > 0) && (
            <section>
              <Eyebrow className="mb-2">{t("aboutEyebrow")}</Eyebrow>
              {prose.map((p, i) => (
                <p key={i} className="mb-3 max-w-[66ch] text-[1.02rem] leading-[1.7] text-[#2A3B4C]">
                  {p}
                </p>
              ))}
              {outcomes.length > 0 && (
                <ul className="mt-[26px] grid border-t border-lp-line sm:grid-cols-2">
                  {outcomes.map((o, i) => (
                    <li
                      key={i}
                      className={cn(
                        "flex gap-3 border-b border-lp-line py-4",
                        i % 2 === 0 ? "sm:pr-4" : "sm:pl-4",
                      )}
                    >
                      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-lp-navy">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <span className="text-[.94rem] text-lp-ink">{o}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ── The path ──────────────────────────────────────────────── */}
          <section className={cn(prose.length > 0 || outcomes.length > 0 ? "mt-[52px]" : "mt-4")}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <Eyebrow className="mb-1.5">{t("programEyebrow")}</Eyebrow>
                <h2 className="font-lp-heading text-[1.65rem] font-semibold text-lp-navy">
                  {t("programTitle")}
                </h2>
              </div>
              <span className="text-[.84rem] text-lp-muted tabular-nums">
                {[
                  t("pathModules", { count: flow.modules.length }),
                  t("pathLessons", { count: curriculum.lessonCount }),
                  exam ? t("pathExam") : null,
                  course.certificateEnabled ? t("pathCertificate") : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-lp-line bg-white shadow-[0_2px_10px_rgba(2,58,105,.05)]">
              {flow.modules.map((m, i) => (
                <ModuleAccordion
                  key={m.id}
                  index={i}
                  summaryClassName="border-b border-lp-line-soft bg-lp-wash-alt px-[22px] py-4 hover:bg-lp-wash"
                  summary={
                    <>
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="font-lp-heading font-semibold text-lp-gold-deep tabular-nums">
                          {String(m.number).padStart(2, "0")}
                        </span>
                        <span className="truncate font-bold text-lp-navy">
                          {pickLocale(m.title, loc)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[.8rem] text-lp-muted tabular-nums">
                        {t("moduleProgress", { done: m.done, total: m.lessons.length })}
                      </span>
                    </>
                  }
                >
                  {m.lessons.map((l) => (
                    <PathLessonRow
                      key={l.id}
                      courseId={course.id}
                      lesson={l}
                      title={pickLocale(l.title, loc)}
                      enrolled={curriculum.enrolled}
                      t={t}
                    />
                  ))}
                </ModuleAccordion>
              ))}

              {exam && (
                <PathExamRow
                  href={curriculum.enrolled ? `/exam/${exam.id}` : null}
                  spec={examSpec}
                  state={examBox}
                  lessonsLeft={Math.max(0, curriculum.lessonCount - curriculum.completedCount)}
                  t={t}
                />
              )}

              {course.certificateEnabled && (
                <div className="grid grid-cols-[32px_1fr] items-center gap-3.5 px-[22px] py-4">
                  <span aria-hidden className="grid size-7 place-items-center rounded-full border-[1.5px] border-dashed border-lp-line-strong text-lp-muted">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="6" />
                      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[.94rem] font-semibold text-lp-slate">{t("pathCertTitle")}</p>
                    <p className="mt-0.5 text-[.8rem] text-lp-muted">{t("pathCertSub")}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Instructor ────────────────────────────────────────────── */}
          {instructor?.fullName && (
            <section className="mt-[52px] grid grid-cols-[auto_1fr] items-center gap-5 border-y border-lp-line py-6">
              <span className="grid h-[76px] w-16 place-items-center border border-lp-navy bg-white font-lp-heading text-[1.4rem] text-lp-navy">
                {initialsOf(instructor.fullName)}
              </span>
              <div>
                <Eyebrow tone="muted" className="mb-1">
                  {t("instructorEyebrow")}
                </Eyebrow>
                <p className="font-lp-heading text-[1.2rem] font-semibold text-lp-navy">
                  {instructor.fullName}
                </p>
                {instructor.bio && (
                  <p className="mt-0.5 text-[.86rem] text-lp-slate">{instructor.bio}</p>
                )}
              </div>
            </section>
          )}
        </main>

        {/* The card rides up over the hero on desktop, and leads on mobile. */}
        <aside className="relative z-[5] order-first -mt-7 lg:sticky lg:top-[84px] lg:order-none lg:-mt-[200px] lg:self-start">
          <EnrollCard
            courseId={course.id}
            coverUrl={course.coverUrl}
            priceTiyin={course.priceTiyin}
            lessonCount={curriculum.lessonCount}
            accessDurationDays={course.accessDurationDays}
            certificateEnabled={course.certificateEnabled}
            isAuthed={Boolean(user)}
            enrolled={curriculum.enrolled}
            lessonStates={flow.lessons.map((l) => l.state)}
            doneCount={curriculum.completedCount}
            resume={
              resume
                ? { id: resume.id, number: resume.number, title: pickLocale(resume.title, loc) }
                : null
            }
            preview={
              previewLesson
                ? { id: previewLesson.id, title: pickLocale(previewLesson.title, loc) }
                : null
            }
            exam={
              exam
                ? {
                    id: exam.id,
                    questions: examQuestions,
                    threshold,
                    passed: examBox?.state === "passed",
                  }
                : null
            }
          />
        </aside>
      </div>
    </div>
  );
}

function HeroStat({ value, label, first = false }: { value: string; label: string; first?: boolean }) {
  return (
    <div className={cn("pr-[26px] pt-4", !first && "border-l border-white/[.14] pl-[26px]")}>
      <dd className="font-lp-heading text-[1.65rem] leading-none text-white">{value}</dd>
      <dt className="mt-1 text-[.78rem] text-lp-on-navy-dim">{label}</dt>
    </div>
  );
}

type CourseT = Awaited<ReturnType<typeof getTranslations<"Course">>>;

function PathLessonRow({
  courseId,
  lesson,
  title,
  enrolled,
  t,
}: {
  courseId: string;
  lesson: FlowLesson;
  title: string;
  enrolled: boolean;
  t: CourseT;
}) {
  const meta = {
    done: t("lessonDone"),
    current: t("lessonNext"),
    preview: t("lessonPreview"),
    locked: enrolled ? t("lessonLocked") : t("lessonLockedGuest"),
  }[lesson.state];
  const right = {
    done: t("lessonDoneAction"),
    current: t("lessonStartAction"),
    preview: t("lessonPreviewAction"),
    locked: "",
  }[lesson.state];

  const inner = (
    <>
      <StateDot state={lesson.state} />
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[.94rem]",
            lesson.state === "locked" ? "font-medium text-lp-muted" : "font-bold text-lp-ink",
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-[.8rem] text-lp-muted">{meta}</span>
      </span>
      <span
        className={cn(
          "whitespace-nowrap text-[.8rem] font-bold",
          lesson.state === "current" ? "text-lp-gold-deep" : "text-lp-success",
          lesson.state === "preview" && "text-lp-navy-mid",
        )}
      >
        {right}
      </span>
    </>
  );
  const cls =
    "grid grid-cols-[32px_1fr_auto] items-center gap-3.5 border-b border-lp-line-soft px-[22px] py-3.5";
  return lesson.openable ? (
    <Link href={`/learn/${courseId}/${lesson.id}`} className={cn(cls, "transition-colors hover:bg-lp-wash")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function PathExamRow({
  href,
  spec,
  state,
  lessonsLeft,
  t,
}: {
  href: string | null;
  spec: string;
  state: Awaited<ReturnType<typeof getFinalExamBox>>;
  lessonsLeft: number;
  t: CourseT;
}) {
  const label = !state
    ? null
    : state.state === "passed"
      ? { text: t("examPassedLabel", { pct: state.bestScorePct ?? 0 }), cls: "text-lp-success" }
      : state.state === "ready"
        ? { text: t("examReadyLabel"), cls: "text-lp-gold-deep" }
        : state.state === "needs_approval"
          ? { text: t("examApprovalLabel"), cls: "text-lp-danger" }
          : { text: t("examLockedLabel", { count: lessonsLeft }), cls: "text-lp-muted" };

  const inner = (
    <>
      <span aria-hidden className="grid size-7 place-items-center rounded-[7px] bg-lp-navy font-lp-heading text-[.85rem] font-semibold text-lp-gold">
        I
      </span>
      <span>
        <span className="block text-[.94rem] font-bold text-lp-navy">{t("examTitle")}</span>
        <span className="mt-0.5 block text-[.8rem] text-lp-muted tabular-nums">{spec}</span>
      </span>
      {label && <span className={cn("text-[.8rem] font-bold", label.cls)}>{label.text}</span>}
    </>
  );
  const cls =
    "grid grid-cols-[32px_1fr_auto] items-center gap-3.5 border-b border-lp-line-soft bg-[#FFFCF3] px-[22px] py-4";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-lp-gold-wash")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/**
 * Prose and a checklist from the one description field.
 *
 * Lines that start with a bullet become the "what you will learn" list; the
 * rest stay paragraphs. That lets whoever writes the course author both in the
 * Studio's existing text box without a second field.
 */
function splitDescription(text: string): { prose: string[]; outcomes: string[] } {
  const prose: string[] = [];
  const outcomes: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) prose.push(para.join(" "));
    para = [];
  };
  for (const raw of (text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    const bullet = line.match(/^(?:[-*•✓✔]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      flush();
      outcomes.push(bullet[1]!);
    } else if (!line) {
      flush();
    } else {
      para.push(line);
    }
  }
  flush();
  return { prose, outcomes };
}

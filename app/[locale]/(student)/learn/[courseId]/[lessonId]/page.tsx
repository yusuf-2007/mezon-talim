import { Lock } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { getFinalExamBox } from "@/lib/assessments/service";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { notesRepository } from "@/lib/db/repositories/notes";
import { commentsRepository } from "@/lib/db/repositories/comments";
import { messagesRepository } from "@/lib/db/repositories/messages";
import { videoQuestionsRepository } from "@/lib/db/repositories/video-questions";
import { glossaryRepository } from "@/lib/db/repositories/glossary";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { questionsRepository } from "@/lib/db/repositories/questions";
import { getCurriculum, locateLesson } from "@/lib/learning/curriculum";
import { buildFlow, clock } from "@/lib/learning/flow";
import { addNoteAction, deleteNoteAction } from "@/lib/learning/actions";
import { pickLocale } from "@/lib/i18n/localized";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoFrame } from "@/components/player/video-frame";
import { CompleteControls } from "@/components/player/complete-controls";
import { AddNoteForm } from "@/components/player/add-note-form";
import { BookmarkButton } from "@/components/player/bookmark-button";
import { DiscussionPanel } from "@/components/player/discussion-panel";
import { AuthorMessagesPanel } from "@/components/player/author-messages-panel";
import { CourseRail } from "@/components/learn/course-rail";
import { FocusBar, initialsOf } from "@/components/learn/flow-ui";
import type { Locale } from "@/lib/i18n/routing";

const PLAYER_TABS = ["notes", "discussion", "ask", "glossary", "text"] as const;

/**
 * The lesson: video, the "did it land" strip, the working tabs underneath, and
 * the course path beside it.
 *
 * The site header is gone here on purpose. A student inside a lesson needs a
 * way back to the course and a sense of how far along they are, and nothing
 * else competing for the eye.
 */
export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { courseId, lessonId } = await params;
  const { tab } = await searchParams;
  // Deep link from bell notifications: /learn/...?tab=ask|discussion
  const initialTab = (PLAYER_TABS as readonly string[]).includes(tab ?? "") ? tab! : "notes";
  const user = await requireUser();
  const locale = (await getLocale()) as Locale;
  const [t, tExam] = await Promise.all([getTranslations("Player"), getTranslations("Exam")]);

  const course = await coursesRepository.findById(courseId);
  if (!course) notFound();

  const curriculum = await getCurriculum(courseId, user.id);
  const { lesson, nextId } = locateLesson(curriculum, lessonId);
  if (!lesson) notFound();

  const flow = buildFlow(curriculum);
  const flowLesson = flow.lessons.find((l) => l.id === lessonId)!;
  const examBox = await getFinalExamBox(courseId, user.id);
  const courseTitle = pickLocale(course.title, locale);

  const bar = (
    <FocusBar
      courseHref={`/courses/${course.slug}`}
      courseTitle={courseTitle}
      backLabel={t("backToCourse")}
      initials={initialsOf(user.fullName ?? user.email ?? user.phone)}
      progress={{ done: curriculum.completedCount, total: curriculum.lessonCount }}
    />
  );
  const rail = (
    <CourseRail
      courseId={courseId}
      modules={flow.modules}
      activeLessonId={lessonId}
      done={curriculum.completedCount}
      total={curriculum.lessonCount}
      exam={examBox}
    />
  );

  // The course owner (and super admins) bypass the sequential lock: they must
  // be able to open any of their lessons — to check content and, crucially, to
  // read and answer private student questions on non-preview lessons.
  const isInstructor =
    user.role === "super_admin" || (user.role === "teacher" && course.createdBy === user.id);

  if (!lesson.accessible && !isInstructor) {
    return (
      <>
        {bar}
        <Layout rail={rail}>
          <div className="rounded-2xl border border-lp-line bg-white px-8 py-14 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full border-[1.5px] border-dashed border-lp-line-strong text-lp-muted">
              <Lock className="size-6" strokeWidth={1.75} />
            </span>
            <p className="mt-4 font-lp-heading text-[1.3rem] font-semibold text-lp-navy">
              {curriculum.enrolled ? t("lockedTitle") : t("notEnrolledTitle")}
            </p>
            <p className="mx-auto mt-1.5 max-w-[44ch] text-[.9rem] text-lp-slate">
              {curriculum.enrolled ? t("locked") : t("notEnrolled")}
            </p>
            <Link
              href={`/courses/${course.slug}`}
              className="mt-5 inline-block rounded-[10px] bg-lp-navy px-5 py-3 text-[.9rem] font-bold text-white"
            >
              {t("backToCourse")}
            </Link>
          </div>
        </Layout>
      </>
    );
  }

  // Private messaging: instructors see every student's thread; everyone else
  // fetches only their own. Privacy is enforced at fetch time.
  const [full, notes, comments, privateMessages, glossary, quiz, videoQuestions] =
    await Promise.all([
      lessonsRepository.findById(lessonId),
      notesRepository.listForLesson(user.id, lessonId),
      commentsRepository.listForLesson(lessonId),
      isInstructor
        ? messagesRepository.listThreadsForLesson(lessonId)
        : messagesRepository.listThread(lessonId, user.id),
      glossaryRepository.listForCourse(courseId),
      assessmentsRepository.findForLesson(lessonId),
      videoQuestionsRepository.listForLessonWithAnswers(lessonId, user.id),
    ]);
  const quizCount = quiz ? await questionsRepository.countByAssessment(quiz.id) : 0;
  const lessonTitle = pickLocale(lesson.title, locale);
  const bodyText = pickLocale(full?.body, locale);

  // Last lesson: next is the exam, when there is one to sit.
  const next = nextId
    ? { href: `/learn/${courseId}/${nextId}`, kind: "lesson" as const }
    : examBox
      ? { href: `/exam/${examBox.assessmentId}`, kind: "exam" as const }
      : null;

  const tabs = [
    { key: "notes", label: t("notes"), count: notes.length },
    { key: "discussion", label: t("discussion"), count: comments.length },
    { key: "ask", label: t("askAuthor"), count: 0 },
    { key: "glossary", label: t("glossary"), count: glossary.length },
    { key: "text", label: t("lessonText"), count: 0 },
  ];

  return (
    <>
      {bar}
      <Layout rail={rail}>
        <div className="overflow-hidden rounded-[14px] bg-[#0A1622] shadow-[0_16px_40px_rgba(1,20,40,.22)]">
          <VideoFrame
            bunnyVideoId={full?.bunnyVideoId ?? null}
            title={lessonTitle}
            videoQuestions={videoQuestions}
            durationSeconds={full?.durationSeconds ?? null}
          />
        </div>

        <div className="mt-[22px] flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="mb-1.5 text-[.74rem] font-bold uppercase tracking-[.12em] text-lp-gold-deep tabular-nums">
              {t("lessonMeta", { module: flowLesson.moduleNumber, lesson: flowLesson.number })}
            </p>
            <h1 className="font-lp-heading text-[1.65rem] font-semibold leading-tight text-lp-navy">
              {lessonTitle}
            </h1>
            <p className="mt-1 text-[.86rem] text-lp-muted">
              {courseTitle}
              {full?.durationSeconds ? ` · ${clock(full.durationSeconds)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quiz && quizCount > 0 && (
              <Link
                href={`/exam/${quiz.id}`}
                className="inline-flex items-center rounded-[9px] border-[1.5px] border-lp-line bg-white px-3.5 py-[9px] text-[.86rem] font-bold text-lp-navy transition-colors hover:bg-lp-wash"
              >
                {tExam("takeQuiz")}
              </Link>
            )}
            <BookmarkButton lessonId={lessonId} />
          </div>
        </div>

        <div className="mt-5">
          <CompleteControls lessonId={lessonId} completed={lesson.completed} next={next} />
        </div>

        <Tabs defaultValue={initialTab} className="mt-7 gap-0">
          <TabsList
            variant="line"
            className="h-auto! w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-lp-line p-0"
          >
            {tabs.map((tb) => (
              <TabsTrigger
                key={tb.key}
                value={tb.key}
                className="-mb-px h-auto flex-none rounded-none border-0 border-b-2 border-transparent px-3.5 py-[11px] text-[.9rem] font-semibold text-lp-muted after:hidden hover:text-lp-navy data-active:border-lp-gold data-active:bg-transparent data-active:font-bold data-active:text-lp-navy"
              >
                {tb.label}
                {tb.count > 0 && (
                  <span className="ml-1.5 text-[.74rem] font-semibold text-lp-muted tabular-nums">
                    {tb.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Notes (B7 + B8 merged: a note may be pinned to a moment) */}
          <TabsContent value="notes" className="pt-5">
            <AddNoteForm action={addNoteAction.bind(null, lessonId)} />
            {notes.length === 0 ? (
              <p className="px-1 pt-4 text-[.88rem] text-lp-muted">{t("noNotes")}</p>
            ) : (
              <ul>
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="grid grid-cols-[64px_1fr_auto] items-start gap-3.5 border-b border-lp-line-soft px-1 py-4"
                  >
                    <span className="pt-0.5 text-[.8rem] font-bold text-lp-navy-mid tabular-nums">
                      {n.timestampSeconds != null ? `▶ ${clock(n.timestampSeconds)}` : "—"}
                    </span>
                    <p className="whitespace-pre-line text-[.92rem] leading-relaxed text-lp-ink">
                      {n.body}
                    </p>
                    <form action={deleteNoteAction.bind(null, lessonId, n.id)}>
                      <button
                        type="submit"
                        className="text-[.8rem] font-bold text-lp-muted transition-colors hover:text-lp-danger"
                      >
                        {t("delete")}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="discussion" className="pt-5">
            <DiscussionPanel
              lessonId={lessonId}
              comments={comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
              currentUserId={user.id}
              canModerate={user.role === "teacher" || user.role === "super_admin"}
            />
          </TabsContent>

          <TabsContent value="ask" className="pt-5">
            {!isInstructor && (
              <p className="mb-4 rounded-xl bg-lp-wash px-4 py-3.5 text-[.86rem] leading-relaxed text-lp-slate">
                {t("askPrivacy")}
              </p>
            )}
            <AuthorMessagesPanel
              lessonId={lessonId}
              messages={privateMessages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
              currentUserId={user.id}
              isInstructor={isInstructor}
            />
          </TabsContent>

          <TabsContent value="glossary" className="pt-2">
            {glossary.length === 0 ? (
              <p className="px-1 pt-3 text-[.88rem] text-lp-muted">{t("noGlossary")}</p>
            ) : (
              <dl>
                {glossary.map((g) => (
                  <div
                    key={g.id}
                    className="grid gap-2 border-b border-lp-line-soft py-4 sm:grid-cols-[180px_1fr] sm:gap-5"
                  >
                    <dt className="font-lp-heading text-[1.1rem] font-semibold text-lp-navy">{g.term}</dt>
                    <dd className="text-[.9rem] leading-relaxed text-[#2A3B4C]">
                      {pickLocale(g.definition, locale)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </TabsContent>

          <TabsContent value="text" className="pt-5">
            {bodyText ? (
              <p className="max-w-[68ch] whitespace-pre-line text-[.98rem] leading-[1.75] text-[#2A3B4C]">
                {bodyText}
              </p>
            ) : (
              <p className="px-1 text-[.88rem] text-lp-muted">{t("noLessonText")}</p>
            )}
          </TabsContent>
        </Tabs>
      </Layout>
    </>
  );
}

/** Content on the left, the course path on the right; the path drops below on mobile. */
function Layout({ children, rail }: { children: React.ReactNode; rail: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1400px] items-start gap-7 px-5 pb-16 pt-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <main className="min-w-0">{children}</main>
      {rail}
    </div>
  );
}

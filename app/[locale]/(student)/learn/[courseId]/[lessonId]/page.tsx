import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { notesRepository } from "@/lib/db/repositories/notes";
import { commentsRepository } from "@/lib/db/repositories/comments";
import { messagesRepository } from "@/lib/db/repositories/messages";
import { glossaryRepository } from "@/lib/db/repositories/glossary";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { questionsRepository } from "@/lib/db/repositories/questions";
import { getCurriculum, locateLesson } from "@/lib/learning/curriculum";
import { addNoteAction, deleteNoteAction } from "@/lib/learning/actions";
import { pickLocale } from "@/lib/i18n/localized";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CoursePlayerShell } from "@/components/player/course-player-shell";
import { VideoFrame } from "@/components/player/video-frame";
import { CompleteControls } from "@/components/player/complete-controls";
import { AddNoteForm } from "@/components/player/add-note-form";
import { DiscussionPanel } from "@/components/player/discussion-panel";
import { AuthorMessagesPanel } from "@/components/player/author-messages-panel";

const PLAYER_TABS = ["notes", "discussion", "ask", "glossary", "text"] as const;

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
  const initialTab = (PLAYER_TABS as readonly string[]).includes(tab ?? "")
    ? (tab as string)
    : "notes";
  const user = await requireUser();
  const locale = await getLocale();
  const t = await getTranslations("Player");
  const tExam = await getTranslations("Exam");

  const course = await coursesRepository.findById(courseId);
  if (!course) notFound();

  const curriculum = await getCurriculum(courseId, user.id);
  const { lesson, prevId, nextId } = locateLesson(curriculum, lessonId);
  if (!lesson) notFound();

  const shellProps = {
    courseId,
    courseSlug: course.slug,
    userId: user.id,
    activeLessonId: lessonId,
  };

  // The course owner (and super admins) bypass the sequential lock: they must
  // be able to open any of their lessons — to check content and, crucially, to
  // read and answer private student questions on non-preview lessons.
  const isInstructor =
    user.role === "super_admin" ||
    (user.role === "teacher" && course.createdBy === user.id);

  // Locked / not-enrolled lesson → message instead of the video.
  if (!lesson.accessible && !isInstructor) {
    return (
      <CoursePlayerShell {...shellProps}>
        <div className="rounded-xl border border-line bg-surface p-10 text-center">
          <p className="text-4xl">🔒</p>
          <p className="mt-4 text-slate-500">
            {curriculum.enrolled ? t("locked") : t("notEnrolled")}
          </p>
        </div>
      </CoursePlayerShell>
    );
  }

  // Private messaging: instructors see every student's thread; everyone else
  // fetches only their own thread. Privacy is enforced here at fetch time —
  // the panel never receives other students' messages.

  const [full, notes, comments, privateMessages, glossary, quiz] =
    await Promise.all([
      lessonsRepository.findById(lessonId),
      notesRepository.listForLesson(user.id, lessonId),
      commentsRepository.listForLesson(lessonId),
      isInstructor
        ? messagesRepository.listThreadsForLesson(lessonId)
        : messagesRepository.listThread(lessonId, user.id),
      glossaryRepository.listForCourse(courseId),
      assessmentsRepository.findForLesson(lessonId),
    ]);
  const quizCount = quiz ? await questionsRepository.countByAssessment(quiz.id) : 0;
  const lessonTitle = pickLocale(lesson.title, locale);
  const bodyText = pickLocale(full?.body, locale);

  return (
    <CoursePlayerShell {...shellProps}>
      <h1 className="font-heading text-2xl font-semibold text-navy-800">
        {lessonTitle}
      </h1>

      <div className="mt-4">
        <VideoFrame bunnyVideoId={full?.bunnyVideoId ?? null} title={lessonTitle} />
      </div>

      {quiz && quizCount > 0 && (
        <div className="mt-4">
          <Button render={<Link href={`/exam/${quiz.id}`} />} variant="outline">
            {tExam("takeQuiz")}
          </Button>
        </div>
      )}

      <div className="mt-5">
        <CompleteControls
          lessonId={lessonId}
          completed={lesson.completed}
          prevHref={prevId ? `/learn/${courseId}/${prevId}` : null}
          nextHref={nextId ? `/learn/${courseId}/${nextId}` : null}
        />
      </div>

      <div className="mt-6">
        <Tabs defaultValue={initialTab}>
          <TabsList>
            <TabsTrigger value="notes">{t("notes")}</TabsTrigger>
            <TabsTrigger value="discussion">{t("discussion")}</TabsTrigger>
            <TabsTrigger value="ask">{t("askAuthor")}</TabsTrigger>
            <TabsTrigger value="glossary">{t("glossary")}</TabsTrigger>
            <TabsTrigger value="text">{t("lessonText")}</TabsTrigger>
          </TabsList>

          {/* Notes (B7 + B8 merged: optional video timestamp per note) */}
          <TabsContent value="notes" className="space-y-4 pt-4">
            <AddNoteForm action={addNoteAction.bind(null, lessonId)} />
            {notes.length === 0 ? (
              <p className="text-sm text-slate-500">{t("noNotes")}</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface p-3"
                  >
                    <p className="whitespace-pre-line text-sm text-ink">
                      {n.timestampSeconds != null && (
                        <span className="mr-2 font-medium tabular-nums text-navy-600">
                          {formatTimestamp(n.timestampSeconds)}
                        </span>
                      )}
                      {n.body}
                    </p>
                    <form action={deleteNoteAction.bind(null, lessonId, n.id)}>
                      <Button type="submit" variant="ghost" size="sm" className="text-danger">
                        {t("delete")}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* Discussion (B19: YouTube-style lesson comments) */}
          <TabsContent value="discussion" className="pt-4">
            <DiscussionPanel
              lessonId={lessonId}
              comments={comments.map((c) => ({
                ...c,
                createdAt: c.createdAt.toISOString(),
              }))}
              currentUserId={user.id}
              canModerate={user.role === "teacher" || user.role === "super_admin"}
            />
          </TabsContent>

          {/* Private student→instructor questions (not public) */}
          <TabsContent value="ask" className="pt-4">
            <AuthorMessagesPanel
              lessonId={lessonId}
              messages={privateMessages.map((m) => ({
                ...m,
                createdAt: m.createdAt.toISOString(),
              }))}
              currentUserId={user.id}
              isInstructor={isInstructor}
            />
          </TabsContent>

          {/* Glossary */}
          <TabsContent value="glossary" className="pt-4">
            {glossary.length === 0 ? (
              <p className="text-sm text-slate-500">{t("noGlossary")}</p>
            ) : (
              <dl className="space-y-3">
                {glossary.map((g) => (
                  <div key={g.id} className="rounded-lg border border-line bg-surface p-3">
                    <dt className="font-medium text-navy-800">{g.term}</dt>
                    <dd className="mt-1 text-sm text-slate-500">
                      {pickLocale(g.definition, locale)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </TabsContent>

          {/* Lesson text */}
          <TabsContent value="text" className="pt-4">
            {bodyText ? (
              <p className="whitespace-pre-line leading-relaxed text-ink">{bodyText}</p>
            ) : (
              <p className="text-sm text-slate-500">{t("noLessonText")}</p>
            )}
          </TabsContent>

        </Tabs>
      </div>
    </CoursePlayerShell>
  );
}

function formatTimestamp(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

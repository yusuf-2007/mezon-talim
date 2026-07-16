import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Link } from "@/lib/i18n/navigation";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { notesRepository } from "@/lib/db/repositories/notes";
import { bookmarksRepository } from "@/lib/db/repositories/bookmarks";
import { glossaryRepository } from "@/lib/db/repositories/glossary";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { questionsRepository } from "@/lib/db/repositories/questions";
import { getCurriculum, locateLesson } from "@/lib/learning/curriculum";
import { getFinalExamBox } from "@/lib/assessments/service";
import {
  addBookmarkAction,
  addNoteAction,
  deleteBookmarkAction,
  deleteNoteAction,
} from "@/lib/learning/actions";
import { pickLocale } from "@/lib/i18n/localized";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlayerSidebar } from "@/components/player/player-sidebar";
import { VideoFrame } from "@/components/player/video-frame";
import { CompleteControls } from "@/components/player/complete-controls";
import { AddNoteForm } from "@/components/player/add-note-form";
import { AddBookmarkForm } from "@/components/player/add-bookmark-form";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const user = await requireUser();
  const locale = await getLocale();
  const t = await getTranslations("Player");
  const tExam = await getTranslations("Exam");

  const course = await coursesRepository.findById(courseId);
  if (!course) notFound();

  const [curriculum, examBox] = await Promise.all([
    getCurriculum(courseId, user.id),
    getFinalExamBox(courseId, user.id),
  ]);
  const { lesson, prevId, nextId } = locateLesson(curriculum, lessonId);
  if (!lesson) notFound();

  const sidebar = (
    <PlayerSidebar
      courseId={courseId}
      curriculum={curriculum}
      activeLessonId={lessonId}
      examBox={examBox}
    />
  );

  // Locked / not-enrolled lesson → message instead of the video.
  if (!lesson.accessible) {
    return (
      <PlayerShell courseSlug={course.slug} sidebar={sidebar}>
        <div className="rounded-xl border border-line bg-surface p-10 text-center">
          <p className="text-4xl">🔒</p>
          <p className="mt-4 text-slate-500">
            {curriculum.enrolled ? t("locked") : t("notEnrolled")}
          </p>
        </div>
      </PlayerShell>
    );
  }

  const [full, notes, bookmarks, glossary, quiz] = await Promise.all([
    lessonsRepository.findById(lessonId),
    notesRepository.listForLesson(user.id, lessonId),
    bookmarksRepository.listForLesson(user.id, lessonId),
    glossaryRepository.listForCourse(courseId),
    assessmentsRepository.findForLesson(lessonId),
  ]);
  const quizCount = quiz ? await questionsRepository.countByAssessment(quiz.id) : 0;
  const lessonTitle = pickLocale(lesson.title, locale);
  const bodyText = pickLocale(full?.body, locale);

  return (
    <PlayerShell courseSlug={course.slug} sidebar={sidebar}>
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
        <Tabs defaultValue="notes">
          <TabsList>
            <TabsTrigger value="notes">{t("notes")}</TabsTrigger>
            <TabsTrigger value="glossary">{t("glossary")}</TabsTrigger>
            <TabsTrigger value="text">{t("lessonText")}</TabsTrigger>
            <TabsTrigger value="bookmarks">{t("bookmarks")}</TabsTrigger>
          </TabsList>

          {/* Notes */}
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
                    <p className="whitespace-pre-line text-sm text-ink">{n.body}</p>
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

          {/* Bookmarks */}
          <TabsContent value="bookmarks" className="space-y-4 pt-4">
            <AddBookmarkForm action={addBookmarkAction.bind(null, lessonId)} />
            {bookmarks.length === 0 ? (
              <p className="text-sm text-slate-500">{t("noBookmarks")}</p>
            ) : (
              <ul className="space-y-2">
                {bookmarks.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3"
                  >
                    <span className="text-sm text-ink">
                      {b.timestampSeconds != null && (
                        <span className="mr-2 font-medium tabular-nums text-navy-600">
                          {formatTimestamp(b.timestampSeconds)}
                        </span>
                      )}
                      {b.label ?? "—"}
                    </span>
                    <form action={deleteBookmarkAction.bind(null, lessonId, b.id)}>
                      <Button type="submit" variant="ghost" size="sm" className="text-danger">
                        {t("delete")}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PlayerShell>
  );
}

function formatTimestamp(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

async function PlayerShell({
  courseSlug,
  sidebar,
  children,
}: {
  courseSlug: string;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = await getTranslations("Player");
  return (
    <div className="mx-auto grid max-w-7xl gap-0 lg:grid-cols-[20rem_1fr]">
      <aside className="hidden border-r border-line bg-surface lg:block lg:min-h-[calc(100vh-4rem)]">
        <div className="border-b border-line p-4">
          <Link href={`/courses/${courseSlug}`} className="text-sm text-navy-600 hover:underline">
            ← {t("backToCourse")}
          </Link>
        </div>
        {sidebar}
      </aside>
      <main className="px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

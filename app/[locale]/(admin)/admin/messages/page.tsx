import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { commentsRepository } from "@/lib/db/repositories/comments";
import { messagesRepository } from "@/lib/db/repositories/messages";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { QuerySelect } from "@/components/admin/query-select";
import { DiscussionPanel } from "@/components/player/discussion-panel";
import { AuthorMessagesPanel } from "@/components/player/author-messages-panel";
import type { Locale } from "@/lib/i18n/routing";

type Section = "discussion" | "ask";

/**
 * Admin Messages panel: every lesson's public discussion and private
 * student→instructor threads in one place — pick a course, pick a lesson,
 * moderate/reply right here. Reuses the exact player panels (and their server
 * actions), so replies from here fire the same bell notifications.
 */
export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; courseId?: string; lessonId?: string }>;
}) {
  const viewer = await requireRole("super_admin");
  const [t, tPlayer] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Player"),
  ]);
  const locale = (await getLocale()) as Locale;
  const sp = await searchParams;
  const section: Section = sp.section === "ask" ? "ask" : "discussion";
  const lessonId = sp.lessonId ?? "";

  const courses = await coursesRepository.listAll();
  // Validate against the real list — a malformed courseId must not reach SQL.
  const courseId = courses.some((c) => c.id === sp.courseId)
    ? (sp.courseId as string)
    : "";
  const lessonRows = courseId
    ? await lessonsRepository.listByCourse(courseId)
    : [];
  const lessonOptions = lessonRows.map((r) => ({
    id: r.lesson.id,
    label: pickLocale(r.lesson.title, locale),
  }));
  // Guard against a stale lessonId after switching course.
  const validLessonId = lessonOptions.some((l) => l.id === lessonId)
    ? lessonId
    : "";

  const sections: { key: Section; label: string }[] = [
    { key: "discussion", label: tPlayer("discussion") },
    { key: "ask", label: tPlayer("askAuthor") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-navy-800">
        {t("messagesTitle")}
      </h1>

      {/* Section switcher — links preserve the course/lesson selection */}
      <div className="flex gap-1 rounded-lg bg-bg p-1 w-fit">
        {sections.map((s) => (
          <Link
            key={s.key}
            href={{
              pathname: "/admin/messages",
              query: {
                section: s.key,
                ...(courseId ? { courseId } : {}),
                ...(validLessonId ? { lessonId: validLessonId } : {}),
              },
            }}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              section === s.key
                ? "bg-surface text-navy-800 shadow-sm"
                : "text-slate-500 hover:text-navy-600",
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Course → lesson pickers, both apply instantly */}
      <div className="flex flex-wrap items-center gap-2">
        <QuerySelect
          param="courseId"
          value={courseId}
          options={courses.map((c) => ({
            id: c.id,
            label: pickLocale(c.title, locale),
          }))}
          placeholder={t("enrollmentsSelectCourse")}
          clears={["lessonId"]}
        />
        {courseId && (
          <QuerySelect
            key={courseId}
            param="lessonId"
            value={validLessonId}
            options={lessonOptions}
            placeholder={t("selectLesson")}
          />
        )}
      </div>

      {!courseId || !validLessonId ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-slate-500 shadow-sm">
          {!courseId ? t("selectCourse") : t("selectLesson")}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          {section === "discussion" ? (
            <LessonDiscussion lessonId={validLessonId} viewerId={viewer.id} />
          ) : (
            <LessonThreads lessonId={validLessonId} viewerId={viewer.id} />
          )}
        </div>
      )}
    </div>
  );
}

async function LessonDiscussion({
  lessonId,
  viewerId,
}: {
  lessonId: string;
  viewerId: string;
}) {
  const comments = await commentsRepository.listForLesson(lessonId);
  return (
    <DiscussionPanel
      lessonId={lessonId}
      comments={comments.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      }))}
      currentUserId={viewerId}
      canModerate
    />
  );
}

async function LessonThreads({
  lessonId,
  viewerId,
}: {
  lessonId: string;
  viewerId: string;
}) {
  const messages = await messagesRepository.listThreadsForLesson(lessonId);
  return (
    <AuthorMessagesPanel
      lessonId={lessonId}
      messages={messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      }))}
      currentUserId={viewerId}
      isInstructor
    />
  );
}

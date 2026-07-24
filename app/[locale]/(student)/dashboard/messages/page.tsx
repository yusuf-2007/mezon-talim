import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { messagesRepository } from "@/lib/db/repositories/messages";
import { commentsRepository } from "@/lib/db/repositories/comments";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  StudentCommentsList,
  StudentThreadsPanel,
  type StudentComment,
  type StudentThread,
} from "@/components/student/student-messages";

type Section = "ask" | "discussion";

/**
 * Student Messages: the student's own side of the communication system — all
 * private instructor threads (continuable right here) and all their public
 * discussion comments, across every course.
 */
export default async function StudentMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const user = await requireUser();
  const locale = await getLocale();
  const [t, tPlayer] = await Promise.all([
    getTranslations("Student"),
    getTranslations("Player"),
  ]);
  const sp = await searchParams;
  const section: Section = sp.section === "discussion" ? "discussion" : "ask";

  const sections: { key: Section; label: string }[] = [
    { key: "ask", label: tPlayer("askAuthor") },
    { key: "discussion", label: tPlayer("discussion") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-navy-800">
        {t("navMessages")}
      </h1>

      <div className="flex w-fit gap-1 rounded-lg bg-bg p-1">
        {sections.map((s) => (
          <Link
            key={s.key}
            href={{ pathname: "/dashboard/messages", query: { section: s.key } }}
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

      {section === "ask" ? (
        <MyThreads userId={user.id} locale={locale} />
      ) : (
        <MyComments userId={user.id} locale={locale} />
      )}
    </div>
  );
}

async function MyThreads({ userId, locale }: { userId: string; locale: string }) {
  const rows = await messagesRepository.listThreadsForStudent(userId);

  // Group into per-lesson threads; newest activity first, awaiting on top is
  // handled visually by badges (a student rarely has many threads).
  const byLesson = new Map<string, StudentThread>();
  for (const m of rows) {
    const entry = byLesson.get(m.lessonId) ?? {
      courseId: m.courseId,
      lessonId: m.lessonId,
      lessonTitle: pickLocale(m.lessonTitle, locale) ?? "—",
      messages: [],
    };
    entry.messages.push({
      id: m.id,
      studentId: m.studentId,
      studentName: m.studentName,
      senderId: m.senderId,
      senderName: m.senderName,
      senderRole: m.senderRole,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    });
    byLesson.set(m.lessonId, entry);
  }
  const threads = [...byLesson.values()].sort(
    (a, b) =>
      Date.parse(b.messages[b.messages.length - 1].createdAt) -
      Date.parse(a.messages[a.messages.length - 1].createdAt),
  );

  return <StudentThreadsPanel threads={threads} currentUserId={userId} />;
}

async function MyComments({ userId, locale }: { userId: string; locale: string }) {
  const rows = await commentsRepository.listForUser(userId);
  const comments: StudentComment[] = rows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    lessonId: c.lessonId,
    lessonTitle: pickLocale(c.lessonTitle, locale) ?? "—",
    courseId: c.courseId,
    replies: c.replies,
  }));
  return <StudentCommentsList comments={comments} />;
}

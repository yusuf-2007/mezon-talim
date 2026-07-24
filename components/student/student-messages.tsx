"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import {
  MessageForm,
  ThreadMessages,
  threadAwaiting,
  type MessageItem,
} from "@/components/player/message-thread";
import { TimeAgo } from "@/components/time-ago";

export type StudentThread = {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  messages: MessageItem[];
};

/**
 * Dashboard "my questions": every private thread the student has, across all
 * courses — status badge, full conversation, and a follow-up box, plus a link
 * back into the lesson itself.
 */
export function StudentThreadsPanel({
  threads,
  currentUserId,
}: {
  threads: StudentThread[];
  currentUserId: string;
}) {
  const t = useTranslations("Player");
  const tS = useTranslations("Student");

  if (threads.length === 0) {
    return <p className="text-sm text-slate-500">{tS("msgNoQuestions")}</p>;
  }

  return (
    <ul className="space-y-4">
      {threads.map((thread) => (
        <li
          key={thread.lessonId}
          className="rounded-xl border border-line bg-surface p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-800">
              {thread.lessonTitle}
              {threadAwaiting(thread.messages) ? (
                <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-medium text-gold-500">
                  {t("msgAwaiting")}
                </span>
              ) : (
                <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-medium text-navy-800">
                  {tS("msgAnswered")}
                </span>
              )}
            </p>
            <Link
              href={`/learn/${thread.courseId}/${thread.lessonId}?tab=ask`}
              className="text-xs font-medium text-navy-600 hover:underline"
            >
              {tS("goToLesson")} →
            </Link>
          </div>
          <ThreadMessages
            messages={thread.messages}
            instructorLabel={t("discInstructor")}
          />
          <div className="mt-3">
            <MessageForm
              lessonId={thread.lessonId}
              threadStudentId={currentUserId}
              placeholder={t("msgPlaceholder")}
              submitLabel={t("msgSend")}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export type StudentComment = {
  id: string;
  body: string;
  createdAt: string;
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  replies: number;
};

/** Dashboard "my comments": where I've spoken in lesson discussions. */
export function StudentCommentsList({ comments }: { comments: StudentComment[] }) {
  const tS = useTranslations("Student");

  if (comments.length === 0) {
    return <p className="text-sm text-slate-500">{tS("msgNoComments")}</p>;
  }

  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <li key={c.id} className="rounded-xl border border-line bg-surface p-4">
          <p className="whitespace-pre-line break-words text-sm text-ink">{c.body}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <Link
              href={`/learn/${c.courseId}/${c.lessonId}?tab=discussion`}
              className="font-medium text-navy-600 hover:underline"
            >
              {c.lessonTitle}
            </Link>
            {c.replies > 0 && (
              <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-medium text-navy-800">
                {tS("msgReplies", { count: c.replies })}
              </span>
            )}
            <TimeAgo iso={c.createdAt} className="text-slate-400" />
          </p>
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  MessageForm,
  ThreadMessages,
  threadAwaiting,
  type MessageItem,
} from "./message-thread";

export type { MessageItem };

/**
 * Private "ask the instructor" panel. Students see only their own thread with
 * the course author; the instructor (course owner / super admin) sees every
 * student's thread for this lesson, each with its own reply box. The server
 * page fetches accordingly — this component never widens visibility.
 */
export function AuthorMessagesPanel({
  lessonId,
  messages,
  currentUserId,
  isInstructor,
}: {
  lessonId: string;
  messages: MessageItem[];
  currentUserId: string;
  isInstructor: boolean;
}) {
  const t = useTranslations("Player");
  const locale = useLocale();
  const [openThread, setOpenThread] = useState<string | null>(null);

  if (!isInstructor) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <span aria-hidden>🔒</span> {t("msgPrivacy")}
        </p>
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">{t("msgEmpty")}</p>
        ) : (
          <ThreadMessages
            messages={messages}
            locale={locale}
            instructorLabel={t("discInstructor")}
          />
        )}
        <MessageForm
          lessonId={lessonId}
          threadStudentId={currentUserId}
          placeholder={t("msgPlaceholder")}
          submitLabel={t("msgSend")}
        />
      </div>
    );
  }

  // Instructor view: group messages into per-student threads. A thread whose
  // LATEST message is the student's still needs an answer — those float to
  // the top (inbox behavior), then by newest activity.
  const threads = new Map<string, MessageItem[]>();
  for (const m of messages) {
    const list = threads.get(m.studentId) ?? [];
    list.push(m);
    threads.set(m.studentId, list);
  }
  const ordered = [...threads.entries()].sort((a, b) => {
    const diff = Number(threadAwaiting(b[1])) - Number(threadAwaiting(a[1]));
    if (diff !== 0) return diff;
    return (
      Date.parse(b[1][b[1].length - 1].createdAt) -
      Date.parse(a[1][a[1].length - 1].createdAt)
    );
  });

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <span aria-hidden>🔒</span> {t("msgInstructorHint")}
      </p>
      {ordered.length === 0 ? (
        <p className="text-sm text-slate-500">{t("msgNoThreads")}</p>
      ) : (
        <ul className="space-y-4">
          {ordered.map(([studentId, thread]) => (
            <li key={studentId} className="rounded-lg border border-line bg-surface p-4">
              <p className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-800">
                {thread[0].studentName ?? "—"}
                {threadAwaiting(thread) && (
                  <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-medium text-gold-500">
                    {t("msgAwaiting")}
                  </span>
                )}
              </p>
              <ThreadMessages
                messages={thread}
                locale={locale}
                instructorLabel={t("discInstructor")}
              />
              <div className="mt-3">
                {openThread === studentId ? (
                  <MessageForm
                    lessonId={lessonId}
                    threadStudentId={studentId}
                    placeholder={t("msgReplyPlaceholder")}
                    submitLabel={t("msgSend")}
                  />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenThread(studentId)}
                  >
                    {t("discReply")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

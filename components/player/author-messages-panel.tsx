"use client";

import { useActionState, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { sendAuthorMessageAction } from "@/lib/community/message-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Serialized message as passed from the server page (dates as ISO strings). */
export type MessageItem = {
  id: string;
  studentId: string;
  studentName: string | null;
  senderId: string;
  senderName: string | null;
  senderRole: "student" | "teacher" | "super_admin" | "accountant";
  body: string;
  createdAt: string;
};

/** "5 minutes ago" via Intl — no per-unit i18n keys needed. */
function timeAgo(iso: string, locale: string): string {
  const diffSec = (Date.parse(iso) - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    for (const [unit, sec] of units) {
      if (Math.abs(diffSec) >= sec) return rtf.format(Math.round(diffSec / sec), unit);
    }
    return rtf.format(Math.round(diffSec), "second");
  } catch {
    return new Date(iso).toLocaleDateString(locale);
  }
}

function MessageForm({
  lessonId,
  threadStudentId,
  placeholder,
  submitLabel,
}: {
  lessonId: string;
  threadStudentId: string;
  placeholder: string;
  submitLabel: string;
}) {
  const t = useTranslations("Player");
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean }, fd: FormData) => {
      const res = await sendAuthorMessageAction(lessonId, threadStudentId, _prev, fd);
      if (res.ok) ref.current?.reset();
      return res;
    },
    { ok: true }, // start clean; only a failed submit flips this
  );

  return (
    <form ref={ref} action={formAction} className="space-y-2">
      <Textarea
        name="body"
        rows={2}
        maxLength={2000}
        placeholder={placeholder}
        required
      />
      <div className="flex items-center justify-end gap-3">
        {!state.ok && <p className="text-xs text-danger">{t("msgError")}</p>}
        <Button type="submit" size="sm" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** One chat thread: student messages left, instructor replies highlighted. */
function ThreadMessages({
  messages,
  locale,
  instructorLabel,
}: {
  messages: MessageItem[];
  locale: string;
  instructorLabel: string;
}) {
  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const fromInstructor =
          m.senderRole === "teacher" || m.senderRole === "super_admin";
        return (
          <li
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-lg border p-3",
              fromInstructor
                ? "ml-auto border-navy-100 bg-navy-100/50"
                : "border-line bg-surface",
            )}
          >
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="font-medium text-ink">{m.senderName ?? "—"}</span>
              {fromInstructor && (
                <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-medium text-navy-800">
                  {instructorLabel}
                </span>
              )}
              <span className="text-slate-400">{timeAgo(m.createdAt, locale)}</span>
            </p>
            <p className="mt-1 whitespace-pre-line break-words text-sm text-ink">
              {m.body}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

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

  // Instructor view: group messages into per-student threads, newest activity first.
  const threads = new Map<string, MessageItem[]>();
  for (const m of messages) {
    const list = threads.get(m.studentId) ?? [];
    list.push(m);
    threads.set(m.studentId, list);
  }
  const ordered = [...threads.entries()].sort(
    (a, b) =>
      Date.parse(b[1][b[1].length - 1].createdAt) -
      Date.parse(a[1][a[1].length - 1].createdAt),
  );

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
              <p className="mb-3 text-sm font-semibold text-navy-800">
                {thread[0].studentName ?? "—"}
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

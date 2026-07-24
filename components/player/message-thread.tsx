"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { sendAuthorMessageAction } from "@/lib/community/message-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TimeAgo } from "@/components/time-ago";
import { cn } from "@/lib/utils";

/** Serialized private message as passed from server pages (dates as ISO). */
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

/** Compose box for a private thread (both sides use the same server action). */
export function MessageForm({
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
export function ThreadMessages({
  messages,
  instructorLabel,
}: {
  messages: MessageItem[];
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
              <TimeAgo iso={m.createdAt} className="text-slate-400" />
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

/** Does the thread still wait for an instructor answer? (last word = student) */
export function threadAwaiting(thread: MessageItem[]): boolean {
  const last = thread[thread.length - 1];
  return last.senderId === last.studentId;
}

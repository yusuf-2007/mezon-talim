"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { addCommentAction, deleteCommentAction } from "@/lib/community/actions";
import { UserAvatar } from "@/components/admin/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TimeAgo } from "@/components/time-ago";
import { cn } from "@/lib/utils";

/** Serialized comment as passed from the server page (dates as ISO strings). */
export type CommentItem = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string | null;
  authorRole: "student" | "teacher" | "super_admin" | "accountant";
  authorHasAvatar: boolean;
};


function CommentForm({
  lessonId,
  parentId,
  placeholder,
  submitLabel,
  autoFocus,
  onDone,
}: {
  lessonId: string;
  parentId: string | null;
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [, formAction, pending] = useActionState(
    async (_prev: { ok: boolean }, fd: FormData) => {
      const res = await addCommentAction(lessonId, parentId, _prev, fd);
      if (res.ok) {
        ref.current?.reset();
        onDone?.();
      }
      return res;
    },
    { ok: false },
  );

  return (
    <form ref={ref} action={formAction} className="space-y-2">
      <Textarea
        name="body"
        rows={2}
        maxLength={2000}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required
      />
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            ✕
          </Button>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function CommentRow({
  comment,
  lessonId,
  isReply,
  canDelete,
  onReply,
  t,
}: {
  comment: CommentItem;
  lessonId: string;
  isReply: boolean;
  canDelete: boolean;
  onReply: () => void;
  t: ReturnType<typeof useTranslations<"Player">>;
}) {
  const instructor =
    comment.authorRole === "teacher" || comment.authorRole === "super_admin";
  return (
    <div className={cn("flex gap-3", isReply && "mt-3")}>
      <UserAvatar
        name={comment.authorName}
        email={null}
        src={comment.authorHasAvatar ? `/api/avatars/${comment.authorId}` : null}
        className={isReply ? "size-7 text-[10px]" : "size-9"}
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium text-ink">
            {comment.authorName ?? "—"}
          </span>
          {instructor && (
            <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-medium text-navy-800">
              {t("discInstructor")}
            </span>
          )}
          <TimeAgo iso={comment.createdAt} className="text-xs text-slate-400" />
        </p>
        <p className="mt-0.5 whitespace-pre-line break-words text-sm text-ink">
          {comment.body}
        </p>
        <div className="mt-1 flex gap-3">
          <button
            type="button"
            onClick={onReply}
            className="text-xs font-medium text-slate-500 hover:text-navy-600"
          >
            {t("discReply")}
          </button>
          {canDelete && (
            <form action={deleteCommentAction.bind(null, lessonId, comment.id)}>
              <button
                type="submit"
                className="text-xs font-medium text-slate-500 hover:text-danger"
              >
                {t("delete")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * YouTube-style per-lesson discussion (B19): top-level comments newest-first,
 * replies chronological beneath them, one open reply box at a time. Instructor
 * comments carry a badge; authors (and teachers/admins) can delete.
 */
export function DiscussionPanel({
  lessonId,
  comments,
  currentUserId,
  canModerate,
}: {
  lessonId: string;
  comments: CommentItem[];
  currentUserId: string;
  canModerate: boolean;
}) {
  const t = useTranslations("Player");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Repo returns newest-first; keep that for threads, flip replies to oldest-first.
  const threads = comments.filter((c) => c.parentId === null);
  const repliesFor = (id: string) =>
    comments.filter((c) => c.parentId === id).slice().reverse();

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-slate-500">
        {t("discCount", { count: comments.length })}
      </p>

      <CommentForm
        lessonId={lessonId}
        parentId={null}
        placeholder={t("discPlaceholder")}
        submitLabel={t("discPost")}
      />

      {threads.length === 0 ? (
        <p className="text-sm text-slate-500">{t("discEmpty")}</p>
      ) : (
        <ul className="space-y-5">
          {threads.map((c) => {
            const replies = repliesFor(c.id);
            return (
              <li key={c.id} className="rounded-lg border border-line bg-surface p-4">
                <CommentRow
                  comment={c}
                  lessonId={lessonId}
                  isReply={false}
                  canDelete={canModerate || c.authorId === currentUserId}
                  onReply={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                  t={t}
                />
                {(replies.length > 0 || replyingTo === c.id) && (
                  <div className="ml-6 mt-1 border-l-2 border-line pl-4 sm:ml-12">
                    {replies.map((r) => (
                      <CommentRow
                        key={r.id}
                        comment={r}
                        lessonId={lessonId}
                        isReply
                        canDelete={canModerate || r.authorId === currentUserId}
                        onReply={() =>
                          setReplyingTo(replyingTo === c.id ? null : c.id)
                        }
                        t={t}
                      />
                    ))}
                    {replyingTo === c.id && (
                      <div className="mt-3">
                        <CommentForm
                          lessonId={lessonId}
                          parentId={c.id}
                          placeholder={t("discReplyPlaceholder")}
                          submitLabel={t("discReply")}
                          autoFocus
                          onDone={() => setReplyingTo(null)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

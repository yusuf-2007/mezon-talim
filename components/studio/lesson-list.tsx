"use client";

import { HelpCircle, Paperclip, Video } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ContentFormState } from "@/lib/content/actions";
import type { StudioAttachment } from "@/lib/attachments/dto";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LessonForm } from "./lesson-form";
import type { StudioLessonVideo } from "./lesson-videos-field";
import { ConfirmSubmit } from "./confirm-submit";

type LessonLike = {
  id: string;
  title: { uz: string; ru?: string };
  body?: { uz: string; ru?: string } | null;
  isPreview: boolean;
};

type Action = (prev: ContentFormState, fd: FormData) => Promise<ContentFormState>;

/**
 * A single lesson row with an inline edit toggle and a delete form.
 *
 * Renders a plain block, not an `<li>`: SortableLessons owns the list item so
 * the drag handle sits outside the row's own click targets.
 */
export function LessonRow({
  lesson,
  videos = [],
  courseId,
  updateAction,
  deleteAction,
  videoQuestionsSlot,
  videoQuestionsCount = 0,
  attachments = [],
  storageConfigured = false,
}: {
  lesson: LessonLike;
  /** The lesson's video parts, loaded by ModuleCard. */
  videos?: StudioLessonVideo[];
  courseId: string;
  updateAction: Action;
  deleteAction: () => Promise<void>;
  /** Server-rendered VideoQuestionsEditor, toggled from here. */
  videoQuestionsSlot?: React.ReactNode;
  videoQuestionsCount?: number;
  /** This lesson's attachments (any status), loaded by ModuleCard. */
  attachments?: StudioAttachment[];
  storageConfigured?: boolean;
}) {
  const t = useTranslations("Studio");
  const [editing, setEditing] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  // An attachment upload is running inside the editor: closing it would
  // abort the upload, so the toggle waits.
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
  const readyAttachments = attachments.filter((a) => a.status === "ready").length;

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{lesson.title.uz}</span>
          {lesson.isPreview && (
            <Badge className="bg-gold-100 text-navy-800">{t("previewBadge")}</Badge>
          )}
          {videos.length === 1 && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Video className="size-3" aria-hidden /> {videos[0].bunnyVideoId.slice(0, 8)}…</span>
          )}
          {videos.length > 1 && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 tabular-nums" data-testid="lesson-parts-badge">
              <Video className="size-3" aria-hidden /> {t("partsCount", { count: videos.length })}
            </span>
          )}
          {readyAttachments > 0 && (
            <span
              className="inline-flex items-center gap-1 text-xs text-slate-500 tabular-nums"
              title={t("attachmentCount", { count: readyAttachments })}
              data-testid="lesson-attachments-badge"
            >
              <Paperclip className="size-3" aria-hidden />
              <span aria-hidden>{readyAttachments}</span>
              <span className="sr-only">{t("attachmentCount", { count: readyAttachments })}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={editing && attachmentsBusy}
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? t("cancel") : t("editLesson")}
          </Button>
          {videoQuestionsSlot && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQuestions((s) => !s)}
            >
              <HelpCircle className="size-3.5" aria-hidden /> {t("vqButton")}
              {videoQuestionsCount > 0 && (
                <span className="ml-1 tabular-nums">({videoQuestionsCount})</span>
              )}
            </Button>
          )}
          <form action={deleteAction}>
            <ConfirmSubmit label={t("delete")} />
          </form>
        </div>
      </div>
      {editing && (
        <div className="mt-3">
          <LessonForm
            action={updateAction}
            lesson={lesson}
            mode="edit"
            onDone={() => setEditing(false)}
            courseId={courseId}
            videos={videos}
            attachments={attachments}
            storageConfigured={storageConfigured}
            onBusyChange={setAttachmentsBusy}
          />
        </div>
      )}
      {showQuestions && videoQuestionsSlot}
    </div>
  );
}

/**
 * Collapsible "add lesson" affordance under a module. `courseId` lets the form
 * upload its queued attachments once the lesson exists.
 */
export function AddLesson({
  action,
  courseId,
  storageConfigured = false,
}: {
  action: Action;
  courseId: string;
  storageConfigured?: boolean;
}) {
  const t = useTranslations("Studio");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + {t("addLesson")}
      </Button>
    );
  }
  return (
    <LessonForm
      action={action}
      mode="create"
      onDone={() => setOpen(false)}
      courseId={courseId}
      storageConfigured={storageConfigured}
    />
  );
}

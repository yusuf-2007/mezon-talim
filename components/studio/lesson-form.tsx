"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ContentFormState } from "@/lib/content/actions";
import type { StudioAttachment } from "@/lib/attachments/dto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field } from "./field";
import { LessonVideosField, type StudioLessonVideo } from "./lesson-videos-field";
import { LessonAttachmentsField, type AttachmentsFieldHandle } from "./lesson-attachments-field";
import { FormError } from "@/components/auth/form-bits";

type LessonLike = {
  /** Required for the attachments section in edit mode. */
  id?: string;
  title: { uz: string; ru?: string };
  body?: { uz: string; ru?: string } | null;
  isPreview: boolean;
};

const initial: ContentFormState = {};

/**
 * Lesson create/edit form. In "create" mode it resets and collapses on success;
 * in "edit" mode it stays open. `action` is a bound server action.
 *
 * Attachments (slides under the video), when `courseId` is given:
 *  - edit mode: managed live by LessonAttachmentsField — each change is saved
 *    on its own, independent of this form's Save. While an upload runs, Save
 *    and Cancel are disabled so the editor cannot close on it.
 *  - create mode: files are queued (and already rendered) in the field; once
 *    createLessonAction returns the new lessonId the form uploads the queue,
 *    then resets and collapses. If any file fails, the lesson still exists:
 *    the form stays open with the lesson fields hidden (it cannot be created
 *    twice), listing the failures with Retry / Remove and a Close button —
 *    files are never dropped silently. Once every leftover file is retried
 *    or removed it collapses on its own.
 */
export function LessonForm({
  action,
  lesson,
  mode,
  onDone,
  courseId,
  videos = [],
  attachments = [],
  storageConfigured = false,
  onBusyChange,
}: {
  action: (prev: ContentFormState, fd: FormData) => Promise<ContentFormState>;
  lesson?: LessonLike;
  mode: "create" | "edit";
  onDone?: () => void;
  /** Enables the attachments section. */
  courseId?: string;
  /** Edit mode: this lesson's saved video parts. */
  videos?: StudioLessonVideo[];
  /** Edit mode: this lesson's attachments, from the server. */
  attachments?: StudioAttachment[];
  storageConfigured?: boolean;
  /** Attachment work in progress (the row disables its own close toggle). */
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useTranslations("Studio");
  const formRef = useRef<HTMLFormElement>(null);
  const attachmentsRef = useRef<AttachmentsFieldHandle>(null);
  // Create mode: the lesson that was just created while its files upload (or
  // after some failed). Hides the lesson fields so it cannot be created twice.
  const [createdLessonId, setCreatedLessonId] = useState<string | null>(null);
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
  // True while the create action itself is uploading the queue (it collapses
  // the form on its own when that succeeds).
  const uploadingAfterCreate = useRef(false);

  function onAttachmentsBusy(busy: boolean) {
    setAttachmentsBusy(busy);
    onBusyChange?.(busy);
  }

  // Create mode, after some uploads failed: once the teacher has retried or
  // removed every leftover file, the lesson is done — collapse like a normal
  // successful create.
  function onAttachmentsQueueSize(size: number) {
    if (size > 0 || mode !== "create" || !createdLessonId || uploadingAfterCreate.current) return;
    resetCreateForm();
    onDone?.();
  }

  // Bumped to remount the parts list empty after a successful create.
  const [videosKey, setVideosKey] = useState(0);

  function resetCreateForm() {
    formRef.current?.reset();
    setVideosKey((k) => k + 1);
    attachmentsRef.current?.reset();
    setCreatedLessonId(null);
  }

  const [state, formAction, pending] = useActionState(
    async (prev: ContentFormState, fd: FormData) => {
      // The lesson already exists (its uploads are being retried): never
      // create it a second time.
      if (createdLessonId) return prev;
      const res = await action(prev, fd);
      if (!res.fieldErrors && !res.error) {
        if (mode === "create") {
          const queue = attachmentsRef.current;
          if (res.lessonId && queue?.hasQueued()) {
            setCreatedLessonId(res.lessonId);
            // Still inside the action, so `pending` keeps the button disabled.
            uploadingAfterCreate.current = true;
            const { failed } = await queue.uploadQueued(res.lessonId).finally(() => {
              uploadingAfterCreate.current = false;
            });
            if (failed > 0) return res; // stay open, showing the failures
          }
          resetCreateForm();
        }
        onDone?.();
      }
      return res;
    },
    initial,
  );

  const lockedAfterCreate = mode === "create" && createdLessonId !== null;
  const attachmentsLessonId = mode === "edit" ? (lesson?.id ?? null) : createdLessonId;
  const showAttachments = Boolean(courseId) && (mode === "create" || Boolean(lesson?.id));

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-lg border border-line bg-bg p-4">
      <FormError message={state.error} />
      {lockedAfterCreate && (
        <p
          role={pending || attachmentsBusy ? "status" : "alert"}
          data-testid="lesson-created-attachments-notice"
          className={
            pending || attachmentsBusy
              ? "rounded-md bg-navy-100 px-3 py-2 text-sm text-navy-800"
              : "rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"
          }
        >
          {pending || attachmentsBusy
            ? t("attachmentUploadingAfterCreate")
            : t("attachmentCreatedWithErrors")}
        </p>
      )}

      {/* Once the lesson exists (create mode, uploads pending or failed) only
          its attachments are left to deal with; the lesson fields go away so
          it cannot be edited or submitted a second time from here. */}
      {!lockedAfterCreate && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("titleUz")} errors={state.fieldErrors?.titleUz}>
              <Input name="titleUz" defaultValue={lesson?.title.uz} required />
            </Field>
            <Field label={t("titleRu")}>
              <Input name="titleRu" defaultValue={lesson?.title.ru ?? ""} />
            </Field>
          </div>

          <LessonVideosField key={videosKey} initial={videos} />
          {state.fieldErrors?.videos && (
            <p className="text-xs text-danger">{state.fieldErrors.videos[0]}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("lessonBodyUz")}>
              <Textarea name="bodyUz" rows={3} defaultValue={lesson?.body?.uz ?? ""} />
            </Field>
            <Field label={t("lessonBodyRu")}>
              <Textarea name="bodyRu" rows={3} defaultValue={lesson?.body?.ru ?? ""} />
            </Field>
          </div>
        </>
      )}

      {showAttachments && courseId && (
        <LessonAttachmentsField
          ref={attachmentsRef}
          courseId={courseId}
          lessonId={attachmentsLessonId}
          mode={mode}
          attachments={attachments}
          storageConfigured={storageConfigured}
          onBusyChange={onAttachmentsBusy}
          onQueueSizeChange={onAttachmentsQueueSize}
        />
      )}

      {!lockedAfterCreate && (
        <label className="flex items-center gap-3">
          <Switch name="isPreview" value="true" defaultChecked={lesson?.isPreview ?? false} />
          <span className="text-sm">{t("isPreview")}</span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {lockedAfterCreate ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending || attachmentsBusy}
            onClick={() => {
              resetCreateForm();
              onDone?.();
            }}
          >
            {t("attachmentClose")}
          </Button>
        ) : (
          <Button type="submit" disabled={pending || (mode === "edit" && attachmentsBusy)}>
            {mode === "create" ? t("addLesson") : t("save")}
          </Button>
        )}
        {mode === "edit" && onDone && (
          <Button type="button" variant="ghost" onClick={onDone} disabled={attachmentsBusy}>
            {t("cancel")}
          </Button>
        )}
        {mode === "edit" && attachmentsBusy && (
          <span className="text-xs text-slate-500">{t("attachmentBusy")}</span>
        )}
      </div>
    </form>
  );
}

/** Collapsible wrapper so an editor only renders when opened. */
export function Collapsible({
  trigger,
  children,
}: {
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger(open, () => setOpen((o) => !o))}
      {open && children(() => setOpen(false))}
    </>
  );
}

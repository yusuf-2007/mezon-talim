"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ContentFormState } from "@/lib/content/actions";
import type { StudioAttachment } from "@/lib/attachments/dto";
import { lookupBunnyVideoAction } from "@/lib/video/actions";
import type { VideoLookupResult } from "@/lib/video";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field } from "./field";
import { LessonAttachmentsField, type AttachmentsFieldHandle } from "./lesson-attachments-field";
import { FormError } from "@/components/auth/form-bits";

/** seconds → "4:32" or "1:04:32" */
function fmtDuration(total: number): string {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/**
 * Live Bunny video panel for the lesson editor: as a GUID is pasted it validates
 * it against the library, shows the thumbnail + encoding status, offers an inline
 * play-preview, and reports the real duration (auto-filled into the form). Purely
 * additive UX around the plain GUID input.
 */
function BunnyVideoPanel({
  info,
  checking,
  onDurationDetected,
}: {
  info: VideoLookupResult | null;
  checking: boolean;
  onDurationDetected: (seconds: number) => void;
}) {
  const t = useTranslations("Studio");
  // Transient preview state; reset per-video via a `key` on this component.
  const [showPlayer, setShowPlayer] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);

  if (checking) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-line bg-bg px-3 py-2 text-sm text-slate-500">
        <span className="size-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-navy-600" />
        {t("bunnyChecking")}
      </div>
    );
  }
  if (!info || info.state === "empty") return null;

  if (info.state === "not_configured") {
    return <StatusPill tone="muted">{t("bunnyNotConfigured")}</StatusPill>;
  }
  if (info.state === "not_found") {
    return <StatusPill tone="error"><XCircle className="size-3.5" /> {t("bunnyNotFound")}</StatusPill>;
  }
  if (info.state === "error") {
    return <StatusPill tone="error"><XCircle className="size-3.5" /> {t("bunnyError")}</StatusPill>;
  }

  // state === "ok"
  const ready = info.ready;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {ready ? (
          <StatusPill tone="success">
            <CheckCircle2 className="size-3.5" /> {t("bunnyReady")}
            {info.durationSeconds > 0 && (
              <span className="ml-1 tabular-nums opacity-80">
                · {fmtDuration(info.durationSeconds)}
              </span>
            )}
          </StatusPill>
        ) : (
          <StatusPill tone="warn">⏳ {t("bunnyProcessing")}</StatusPill>
        )}
        {info.durationSeconds > 0 && (
          <button
            type="button"
            className="text-xs font-medium text-navy-600 underline-offset-2 hover:underline"
            onClick={() => onDurationDetected(info.durationSeconds)}
          >
            {t("bunnyUseDuration", { value: fmtDuration(info.durationSeconds) })}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-navy-900">
        {showPlayer ? (
          <div className="aspect-video w-full">
            <iframe
              src={info.embedUrl}
              title={info.title || "preview"}
              loading="lazy"
              allow="fullscreen; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => ready && setShowPlayer(true)}
            className="group relative block aspect-video w-full disabled:cursor-default"
            disabled={!ready}
            aria-label={t("bunnyPreview")}
          >
            {!thumbBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={info.thumbnailUrl}
                alt={info.title || ""}
                className="h-full w-full object-cover"
                onError={() => setThumbBroken(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-navy-100">
                {info.title || info.guid}
              </div>
            )}
            {ready && (
              <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/35">
                <span className="grid size-14 place-items-center rounded-full bg-white/90 text-navy-900 shadow-lg transition-transform group-hover:scale-105">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warn" | "error" | "muted";
  children: React.ReactNode;
}) {
  const toneClass = {
    success: "bg-success/10 text-success",
    warn: "bg-gold-100 text-ink",
    error: "bg-danger/10 text-danger",
    muted: "bg-line text-slate-500",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${toneClass}`}
    >
      {children}
    </span>
  );
}

type LessonLike = {
  /** Required for the attachments section in edit mode. */
  id?: string;
  title: { uz: string; ru?: string };
  body?: { uz: string; ru?: string } | null;
  bunnyVideoId?: string | null;
  durationSeconds?: number | null;
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

  // Controlled so the Bunny panel can auto-fill duration and reset cleanly.
  const [guid, setGuid] = useState(lesson?.bunnyVideoId ?? "");
  const [duration, setDuration] = useState(
    lesson?.durationSeconds != null ? String(lesson.durationSeconds) : "",
  );
  const [videoInfo, setVideoInfo] = useState<VideoLookupResult | null>(null);
  const [checking, setChecking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Event-driven debounced lookup (not an effect): validates the pasted GUID,
  // pulls thumbnail/status, and auto-fills duration when the field is empty.
  function onGuidChange(next: string) {
    setGuid(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const g = next.trim();
    if (g.length < 32) {
      setVideoInfo(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      const res = await lookupBunnyVideoAction(g);
      setVideoInfo(res);
      setChecking(false);
      if (res.state === "ok" && res.durationSeconds > 0) {
        setDuration((d) => (d.trim() ? d : String(res.durationSeconds)));
      }
    }, 600);
  }

  // Edit mode: look up the already-saved video once on mount so its preview shows.
  useEffect(() => {
    const g = (lesson?.bunnyVideoId ?? "").trim();
    if (g.length < 32) return;
    let active = true;
    void lookupBunnyVideoAction(g).then((res) => {
      if (active) setVideoInfo(res);
    });
    return () => {
      active = false;
    };
    // Mount-only: intentionally not re-run when the prop identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetCreateForm() {
    formRef.current?.reset();
    setGuid("");
    setDuration("");
    setVideoInfo(null);
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("bunnyVideoId")} hint={t("bunnyHint")}>
              <Input
                name="bunnyVideoId"
                value={guid}
                onChange={(e) => onGuidChange(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </Field>
            <Field label={t("durationSeconds")}>
              <Input
                name="durationSeconds"
                type="number"
                min={0}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="tabular-nums"
              />
            </Field>
          </div>

          <BunnyVideoPanel
            key={videoInfo?.state === "ok" ? videoInfo.guid : "none"}
            info={videoInfo}
            checking={checking}
            onDurationDetected={(s) => setDuration(String(s))}
          />

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

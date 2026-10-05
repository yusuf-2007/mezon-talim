"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  CloudUpload,
  File as FileIcon,
  FileImage,
  FileText,
  RotateCw,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  deleteAttachmentAction,
  reorderAttachmentsAction,
  updateAttachmentAction,
} from "@/lib/attachments/actions";
import type { StudioAttachment } from "@/lib/attachments/dto";
import {
  ACCEPTED_MIME,
  MAX_ATTACHMENTS_PER_LESSON,
  MAX_IMAGE_BYTES,
  MAX_PAGES,
  MAX_PDF_BYTES,
  kindForMime,
  maxBytesForKind,
  type AttachmentKind,
} from "@/lib/attachments/limits";
import {
  RasterizeError,
  rasterizeAttachment,
  type PreparedAttachment,
} from "@/lib/attachments/rasterize";
import { uploadPreparedAttachment } from "@/lib/attachments/upload-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const MB = 1024 * 1024;

/**
 * Upload queue item phases:
 *  new        → added, slides not rendered yet
 *  preparing  → rendering slides in the browser
 *  ready      → rendered; waits for a lesson (create mode) or its turn
 *  uploading  → begin + bucket POSTs in flight
 *  finalizing → server is verifying the upload
 *  failed     → upload failed; Retry re-uploads the already-rendered slides
 *  invalid    → the file itself was refused (type, size, unreadable…)
 */
type Phase = "new" | "preparing" | "ready" | "uploading" | "finalizing" | "failed" | "invalid";

type QueueItem = {
  key: string;
  file: File;
  phase: Phase;
  /** Passed to begin; only editable before the upload starts. */
  allowDownload: boolean;
  prepDone: number;
  prepTotal: number;
  /** Upload progress, 0..1. */
  progress: number;
  slideCount: number;
  error: string | null;
  /** Set once begin succeeded (the server row exists, status uploading). */
  attachmentId: string | null;
};

/** Phases during which the component is doing work. */
const WORKING: ReadonlySet<Phase> = new Set(["new", "preparing", "uploading", "finalizing"]);

export type AttachmentsFieldHandle = {
  /** Anything in the local queue (including refused files the teacher has not dismissed). */
  hasQueued(): boolean;
  /**
   * Create mode: upload everything queued to the just-created lesson, one file
   * at a time. Resolves when the queue has drained; `failed` counts the items
   * left behind (failed or refused), which stay listed for retry/removal.
   */
  uploadQueued(lessonId: string): Promise<{ failed: number }>;
  /** Drop the queue and local results (after the create form collapses). */
  reset(): void;
};

/** Kind from the browser's type, or from the extension when the type is blank. */
function guessKind(file: File): AttachmentKind | null {
  const byType = kindForMime(file.type);
  if (byType) return byType;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "image";
  return null;
}

function useFormatBytes() {
  const locale = useLocale();
  return useMemo(() => {
    const mb = new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "megabyte",
      maximumFractionDigits: 1,
    });
    const kb = new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "kilobyte",
      maximumFractionDigits: 0,
    });
    return (bytes: number) =>
      bytes >= MB ? mb.format(bytes / MB) : kb.format(Math.max(1, Math.round(bytes / 1024)));
  }, [locale]);
}

/**
 * The "Attachments (slides)" section of the Studio / Admin lesson form.
 *
 * - Edit mode (`lessonId` set): every operation applies immediately, on its
 *   own, independent of the lesson's Save button. Added files are rendered to
 *   slides and uploaded right away, one at a time.
 * - Create mode (`lessonId` null): added files are rendered and validated at
 *   once (so problems show early) and wait; the form calls `uploadQueued`
 *   after the lesson exists.
 *
 * Saved attachments come from the server (`attachments`, refreshed by each
 * action's revalidation); results of this component's own actions are kept
 * locally too, so a just-finished upload shows before that refresh lands and
 * the create form (which has no server rows) can list what it uploaded.
 */
export function LessonAttachmentsField({
  ref,
  courseId,
  lessonId,
  mode,
  attachments,
  storageConfigured,
  onBusyChange,
  onQueueSizeChange,
}: {
  ref?: React.Ref<AttachmentsFieldHandle>;
  courseId: string;
  /** The lesson attachments belong to; null in create mode until it exists. */
  lessonId: string | null;
  mode: "create" | "edit";
  /** Server rows for this lesson (any status). Empty in create mode. */
  attachments: StudioAttachment[];
  storageConfigured: boolean;
  /** True while rendering/uploading — the form must not close meanwhile. */
  onBusyChange?: (busy: boolean) => void;
  /** Number of local (not yet saved) files, including failed/refused ones. */
  onQueueSizeChange?: (size: number) => void;
}) {
  const t = useTranslations("Studio");
  const formatBytes = useFormatBytes();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // ── Local queue ────────────────────────────────────────────────────────────
  // The worker loop reads the ref (always current); React renders the state
  // copy. Every change goes through commit() so the two never diverge.
  const [items, setItems] = useState<QueueItem[]>([]);
  const itemsRef = useRef<QueueItem[]>([]);
  const preparedRef = useRef(new Map<string, PreparedAttachment>());
  const controllersRef = useRef(new Map<string, AbortController>());
  const lifeRef = useRef<AbortController | null>(null);
  const targetRef = useRef<string | null>(lessonId);
  const runningRef = useRef(false);
  const waitersRef = useRef<Array<() => void>>([]);
  const keySeq = useRef(0);

  // Attachments this component created/updated, by id (see doc comment).
  const [known, setKnown] = useState<Record<string, StudioAttachment>>({});
  // Deleted here; hidden until the server list stops including them.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [listError, setListError] = useState<string | null>(null);

  const commit = useCallback((next: QueueItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const patch = useCallback(
    (key: string, p: Partial<QueueItem>) => {
      if (!itemsRef.current.some((i) => i.key === key)) return;
      commit(itemsRef.current.map((i) => (i.key === key ? { ...i, ...p } : i)));
    },
    [commit],
  );

  const exists = (key: string) => itemsRef.current.some((i) => i.key === key);

  /** Abort + forget an item (removal, or after its upload succeeded). */
  const drop = useCallback(
    (key: string) => {
      controllersRef.current.get(key)?.abort();
      controllersRef.current.delete(key);
      preparedRef.current.delete(key);
      commit(itemsRef.current.filter((i) => i.key !== key));
    },
    [commit],
  );

  /** A fresh per-attempt controller, aborted with the component too. */
  const controllerFor = (key: string): AbortController => {
    controllersRef.current.get(key)?.abort();
    const c = new AbortController();
    const life = lifeRef.current;
    if (!life || life.signal.aborted) c.abort();
    else life.signal.addEventListener("abort", () => c.abort(), { once: true });
    controllersRef.current.set(key, c);
    return c;
  };

  // Lifetime: created in the effect (not a ref initializer) so StrictMode's
  // mount → unmount → mount leaves a live controller. Unmounting aborts every
  // render and upload; an upload aborted after begin deletes its own row.
  useEffect(() => {
    const life = new AbortController();
    lifeRef.current = life;
    const controllers = controllersRef.current;
    const prepared = preparedRef.current;
    return () => {
      life.abort();
      lifeRef.current = null;
      for (const c of controllers.values()) c.abort();
      controllers.clear();
      prepared.clear();
    };
  }, []);

  const rasterizeMessage = (err: unknown): string => {
    const code = err instanceof RasterizeError ? err.code : "unreadable";
    switch (code) {
      case "bad_type":
        return t("attachmentErrType");
      case "too_large":
        return t("attachmentErrTooLarge", { pdfMb: MAX_PDF_BYTES / MB, imageMb: MAX_IMAGE_BYTES / MB });
      case "too_many_pages":
        return t("attachmentErrTooManyPages", { max: MAX_PAGES });
      case "password":
        return t("attachmentErrPassword");
      case "slide_too_large":
        return t("attachmentErrSlideTooLarge");
      default:
        return t("attachmentErrUnreadable");
    }
  };

  async function prepare(item: QueueItem) {
    const ctrl = controllerFor(item.key);
    patch(item.key, { phase: "preparing", prepDone: 0, prepTotal: 0, error: null });
    try {
      const prepared = await rasterizeAttachment(item.file, {
        signal: ctrl.signal,
        onProgress: (done, total) => patch(item.key, { prepDone: done, prepTotal: total }),
      });
      if (!exists(item.key) || ctrl.signal.aborted) return;
      preparedRef.current.set(item.key, prepared);
      patch(item.key, { phase: "ready", slideCount: prepared.slides.length });
    } catch (err) {
      if (!exists(item.key) || ctrl.signal.aborted) return;
      patch(item.key, { phase: "invalid", error: rasterizeMessage(err) });
    }
  }

  async function upload(item: QueueItem, target: string) {
    const prepared = preparedRef.current.get(item.key);
    if (!prepared) {
      patch(item.key, { phase: "invalid", error: t("attachmentErrUnreadable") });
      return;
    }
    const ctrl = controllerFor(item.key);
    patch(item.key, { phase: "uploading", progress: 0, error: null, attachmentId: null });
    const res = await uploadPreparedAttachment({
      courseId,
      lessonId: target,
      prepared,
      allowDownload: item.allowDownload,
      signal: ctrl.signal,
      onBegun: (attachmentId) => patch(item.key, { attachmentId }),
      onProgress: (progress) => patch(item.key, { progress }),
      onFinalizing: () => patch(item.key, { phase: "finalizing", progress: 1 }),
    });
    if (res.ok) {
      // Same batch: the saved row appears as the queue row leaves.
      setKnown((k) => ({ ...k, [res.attachment.id]: res.attachment }));
      drop(item.key);
      return;
    }
    if (res.aborted) return; // removed, or the form closed
    patch(item.key, {
      phase: "failed",
      attachmentId: null,
      error:
        res.error ??
        (res.clientCode === "rejected" ? t("attachmentErrRejected") : t("attachmentErrNetwork")),
    });
  }

  /**
   * The single worker: strictly one file at a time, in list order — render
   * it, then (once there is a lesson) upload it. Re-entrant calls are no-ops;
   * the running loop re-scans the queue after every step.
   */
  async function run() {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      for (;;) {
        if (!lifeRef.current || lifeRef.current.signal.aborted) break;
        const target = targetRef.current;
        const next = itemsRef.current.find(
          (i) => i.phase === "new" || (i.phase === "ready" && target !== null),
        );
        if (!next) break;
        if (next.phase === "new") await prepare(next);
        else await upload(next, target!);
      }
    } finally {
      runningRef.current = false;
      const waiters = waitersRef.current;
      waitersRef.current = [];
      for (const w of waiters) w();
    }
  }
  const kick = () => void run();

  // Edit mode (or a create form whose lesson now exists): upload as files come.
  useEffect(() => {
    targetRef.current = lessonId;
    if (lessonId) void run();
    // run() only reads refs; re-running on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useImperativeHandle(
    ref,
    () => ({
      hasQueued: () => itemsRef.current.length > 0,
      uploadQueued: (id: string) => {
        targetRef.current = id;
        return new Promise<{ failed: number }>((resolve) => {
          waitersRef.current.push(() => resolve({ failed: itemsRef.current.length }));
          // Already running → the loop picks the uploads up and resolves us.
          if (!runningRef.current) void run();
        });
      },
      reset: () => {
        for (const c of controllersRef.current.values()) c.abort();
        controllersRef.current.clear();
        preparedRef.current.clear();
        commit([]);
        setKnown({});
        setRemoved(new Set());
        setListError(null);
      },
    }),
    // The handle reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Saved list (server rows ∪ local results) ──────────────────────────────
  const inFlightIds = new Set(
    items.filter((i) => i.attachmentId).map((i) => i.attachmentId as string),
  );
  // Between begin's response (which refreshes the page) and onBegun, the new
  // row can arrive before its id is known locally; hide fresh "uploading"
  // rows while such a begin is outstanding so it never shows as stuck.
  const beginPending = items.some((i) => i.phase === "uploading" && !i.attachmentId);

  const saved = useMemo(() => {
    const byId = new Map<string, StudioAttachment>();
    for (const a of Object.values(known)) byId.set(a.id, a);
    // The server copy wins once it has the row: it is refreshed by every action.
    for (const a of attachments) byId.set(a.id, a);
    return [...byId.values()]
      .filter((a) => !removed.has(a.id) && a.lessonId === (lessonId ?? a.lessonId))
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [attachments, known, removed, lessonId]);

  const visibleSaved = saved.filter(
    (a) => !inFlightIds.has(a.id) && !(beginPending && a.status === "uploading"),
  );

  const busy = items.some((i) => WORKING.has(i.phase) || (i.phase === "ready" && lessonId !== null));

  // Effect events: report changes only, not every time the parent re-renders
  // with a new callback identity.
  const reportBusy = useEffectEvent((b: boolean) => onBusyChange?.(b));
  const reportQueueSize = useEffectEvent((n: number) => onQueueSizeChange?.(n));
  useEffect(() => {
    reportBusy(busy);
  }, [busy]);
  useEffect(() => {
    reportQueueSize(items.length);
  }, [items.length]);

  // Closing the tab mid-upload loses the work; ask first.
  useEffect(() => {
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busy]);

  // ── Ordering (optimistic, like SortableLessons) ───────────────────────────
  const serverOrder = visibleSaved.map((a) => a.id);
  const [order, setOrder] = useOptimistic(serverOrder);
  const [reordering, startReorder] = useTransition();
  const byId = new Map(visibleSaved.map((a) => [a.id, a]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as StudioAttachment[];
  // Reorder needs the lesson's full set; in-flight rows are hidden, so wait.
  const canReorder = lessonId !== null && !busy && !reordering && ordered.length > 1;

  // Keyboard focus has to survive a move: the pressed arrow is disabled while
  // the save is pending (focus falls to <body>), and "move down" re-inserts
  // its row in the DOM. Once the save settles, focus goes back to the moved
  // row's arrow — or its other arrow, if it just reached the end of the list.
  const moveButtons = useRef(new Map<string, HTMLButtonElement>());
  const refocusAfterMove = useRef<{ id: string; delta: -1 | 1 } | null>(null);
  const moveButtonRef = useCallback(
    (id: string, delta: -1 | 1) => (el: HTMLButtonElement | null) => {
      if (el) moveButtons.current.set(`${id}:${delta}`, el);
      else moveButtons.current.delete(`${id}:${delta}`);
    },
    [],
  );
  useEffect(() => {
    if (reordering) return;
    const pending = refocusAfterMove.current;
    refocusAfterMove.current = null;
    if (!pending) return;
    // Only when focus was really lost; never steal it from where the teacher went.
    if (document.activeElement && document.activeElement !== document.body) return;
    const usable = (el: HTMLButtonElement | undefined) => (el && !el.disabled ? el : null);
    (
      usable(moveButtons.current.get(`${pending.id}:${pending.delta}`)) ??
      usable(moveButtons.current.get(`${pending.id}:${-pending.delta}`))
    )?.focus();
  }, [reordering]);

  function move(id: string, delta: -1 | 1) {
    if (!lessonId || !canReorder) return;
    const from = order.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    setListError(null);
    refocusAfterMove.current = { id, delta };
    const target = lessonId;
    startReorder(async () => {
      setOrder(next);
      const res = await reorderAttachmentsAction(courseId, target, next);
      if (!res.ok) {
        setListError(res.error);
        return;
      }
      // Keep local copies in step (the create form has no server rows).
      setKnown((k) => {
        const out = { ...k };
        next.forEach((nid, idx) => {
          if (out[nid]) out[nid] = { ...out[nid], orderIndex: idx };
        });
        return out;
      });
    });
  }

  async function remove(a: StudioAttachment) {
    if (!window.confirm(t("attachmentConfirmDelete"))) return;
    setListError(null);
    setRemoved((s) => new Set(s).add(a.id));
    const res = await deleteAttachmentAction(courseId, a.id).catch(() => null);
    if (!res || !res.ok) {
      setRemoved((s) => {
        const n = new Set(s);
        n.delete(a.id);
        return n;
      });
      setListError(res?.error ?? t("attachmentErrNetwork"));
      return;
    }
    setKnown((k) => {
      const { [a.id]: _gone, ...rest } = k;
      return rest;
    });
  }

  const onUpdated = useCallback((a: StudioAttachment) => {
    setKnown((k) => ({ ...k, [a.id]: a }));
  }, []);

  // ── Adding files ──────────────────────────────────────────────────────────
  function addFiles(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    setListError(null);
    const taken = saved.length + itemsRef.current.filter((i) => i.phase !== "invalid").length;
    let room = MAX_ATTACHMENTS_PER_LESSON - taken;

    const added = files.map((file): QueueItem => {
      const base: QueueItem = {
        key: `f${++keySeq.current}`,
        file,
        phase: "new",
        allowDownload: false,
        prepDone: 0,
        prepTotal: 0,
        progress: 0,
        slideCount: 0,
        error: null,
        attachmentId: null,
      };
      // Instant checks; the bytes are sniffed again while rendering.
      const kind = guessKind(file);
      if (!kind) return { ...base, phase: "invalid", error: t("attachmentErrType") };
      if (file.size > maxBytesForKind(kind)) {
        return {
          ...base,
          phase: "invalid",
          error: t("attachmentErrTooLarge", { pdfMb: MAX_PDF_BYTES / MB, imageMb: MAX_IMAGE_BYTES / MB }),
        };
      }
      if (room <= 0) {
        return {
          ...base,
          phase: "invalid",
          error: t("attachmentErrTooMany", { max: MAX_ATTACHMENTS_PER_LESSON }),
        };
      }
      room--;
      return base;
    });
    commit([...itemsRef.current, ...added]);
    kick();
  }

  function retry(key: string) {
    patch(key, { phase: "ready", error: null, progress: 0 });
    kick();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const headingId = `attachments-${lessonId ?? "new"}`;

  return (
    <section
      aria-labelledby={headingId}
      data-testid="lesson-attachments"
      className="space-y-3 rounded-lg border border-line bg-surface p-3 sm:p-4"
    >
      <div className="space-y-1">
        <p id={headingId} className="text-sm font-semibold text-navy-800">
          {t("attachmentsTitle")}
        </p>
        <p className="text-xs text-slate-500">{t("attachmentsHint")}</p>
        {storageConfigured && (
          <p className="text-xs text-slate-500">
            {mode === "edit" ? t("attachmentsHintEdit") : t("attachmentsHintCreate")}
          </p>
        )}
      </div>

      {!storageConfigured ? (
        <p
          data-testid="attachments-not-configured"
          className="rounded-md border border-dashed border-line bg-bg px-3 py-2 text-sm text-slate-500"
        >
          {t("attachmentsNotConfigured")}
        </p>
      ) : (
        <>
          {ordered.length > 0 && (
            <ul className="space-y-2" aria-label={t("attachmentsTitle")}>
              {ordered.map((a, idx) => (
                <SavedAttachmentRow
                  key={a.id}
                  courseId={courseId}
                  attachment={a}
                  formatBytes={formatBytes}
                  canMoveUp={canReorder && idx > 0}
                  canMoveDown={canReorder && idx < ordered.length - 1}
                  moveButtonRef={(d) => moveButtonRef(a.id, d)}
                  onMove={(d) => move(a.id, d)}
                  onDelete={() => void remove(a)}
                  onUpdated={onUpdated}
                />
              ))}
            </ul>
          )}

          {items.length > 0 && (
            <ul className="space-y-2" aria-live="polite">
              {items.map((item) => (
                <QueueRow
                  key={item.key}
                  item={item}
                  hasLesson={lessonId !== null}
                  formatBytes={formatBytes}
                  onRetry={() => retry(item.key)}
                  onRemove={() => drop(item.key)}
                  onAllowDownload={(v) => patch(item.key, { allowDownload: v })}
                />
              ))}
            </ul>
          )}

          {ordered.length === 0 && items.length === 0 && (
            <p className="text-sm text-slate-500">{t("attachmentsEmpty")}</p>
          )}

          <div
            data-testid="attachments-dropzone"
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes("Files")) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
            }}
            onDrop={(e) => {
              if (!e.dataTransfer.types.includes("Files")) return;
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors",
              dragOver ? "border-navy-600 bg-navy-100" : "border-line bg-bg",
            )}
          >
            <CloudUpload className="size-5 text-navy-600" aria-hidden />
            <p className="text-sm text-ink">
              {t("attachmentsDrop")}{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded font-medium text-navy-600 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:outline-none"
              >
                {t("attachmentsBrowse")}
              </button>
            </p>
            <p className="text-xs text-slate-500">
              {t("attachmentsLimits", {
                pdfMb: MAX_PDF_BYTES / MB,
                maxPages: MAX_PAGES,
                imageMb: MAX_IMAGE_BYTES / MB,
                max: MAX_ATTACHMENTS_PER_LESSON,
              })}
            </p>
            {/* No `name`: the lesson form's FormData must never carry files. */}
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED_MIME.join(",")}
              className="hidden"
              data-testid="attachments-input"
              onChange={(e) => {
                addFiles(e.currentTarget.files);
                e.currentTarget.value = ""; // allow picking the same file again
              }}
            />
          </div>

          {listError && (
            <p role="alert" className="text-sm text-danger">
              {listError}
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ── Rows ────────────────────────────────────────────────────────────────────

function KindIcon({ kind, className }: { kind: AttachmentKind | null; className?: string }) {
  const Icon = kind === "pdf" ? FileText : kind === "image" ? FileImage : FileIcon;
  return <Icon className={className} aria-hidden />;
}

function Thumb({ attachment }: { attachment: StudioAttachment }) {
  const t = useTranslations("Studio");
  const [broken, setBroken] = useState(false);
  const ready = attachment.status === "ready";
  return (
    <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface">
      {ready && !broken ? (
        // Same-origin, access-checked route; instructors see their own
        // watermark on view-only decks, exactly as students will.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.thumbUrl}
          alt={t("attachmentThumbAlt", { title: attachment.titleUz })}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      ) : ready ? (
        <KindIcon kind={attachment.kind} className="size-6 text-slate-400" />
      ) : (
        <TriangleAlert className="size-6 text-gold-400" aria-hidden />
      )}
    </div>
  );
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

function SavedAttachmentRow({
  courseId,
  attachment: a,
  formatBytes,
  canMoveUp,
  canMoveDown,
  moveButtonRef,
  onMove,
  onDelete,
  onUpdated,
}: {
  courseId: string;
  attachment: StudioAttachment;
  formatBytes: (bytes: number) => string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Lets the list put focus back on this row's arrow after a move. */
  moveButtonRef: (delta: -1 | 1) => (el: HTMLButtonElement | null) => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
  onUpdated: (a: StudioAttachment) => void;
}) {
  const t = useTranslations("Studio");
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [allowDownload, setAllowDownload] = useOptimistic(a.allowDownload);
  const [toggling, startToggle] = useTransition();
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ready = a.status === "ready";

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  function flashSaved() {
    setSave({ kind: "saved" });
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSave({ kind: "idle" }), 2500);
  }

  async function saveTitle(field: "titleUz" | "titleRu", input: HTMLInputElement) {
    const value = input.value.trim();
    if (value === (field === "titleUz" ? a.titleUz : a.titleRu)) return;
    if (field === "titleUz" && !value) {
      input.value = a.titleUz;
      setSave({ kind: "error", message: t("attachmentTitleRequired") });
      return;
    }
    setSave({ kind: "saving" });
    const res = await updateAttachmentAction(courseId, a.id, { [field]: value }).catch(() => null);
    if (!res || !res.ok) {
      setSave({ kind: "error", message: res?.error ?? t("attachmentErrNetwork") });
      return;
    }
    onUpdated(res.attachment);
    flashSaved();
  }

  function toggleDownload(next: boolean) {
    startToggle(async () => {
      setAllowDownload(next);
      const res = await updateAttachmentAction(courseId, a.id, { allowDownload: next }).catch(
        () => null,
      );
      if (!res || !res.ok) {
        setSave({ kind: "error", message: res?.error ?? t("attachmentErrNetwork") });
        return;
      }
      onUpdated(res.attachment);
      flashSaved();
    });
  }

  // Enter in a title must save it, not submit the surrounding lesson form.
  const onTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const meta = [
    a.kind === "pdf" ? t("attachmentKindPdf") : t("attachmentKindImage"),
    t("attachmentSlides", { count: a.pageCount }),
    formatBytes(a.sizeBytes),
  ].join(" · ");

  return (
    <li
      data-testid="attachment-row"
      data-attachment-id={a.id}
      data-status={a.status}
      className="flex flex-col gap-3 rounded-md border border-line bg-bg p-3 sm:flex-row"
    >
      <Thumb attachment={a} />

      <div className="min-w-0 flex-1 space-y-2">
        {ready ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">{t("titleUz")}</span>
              <Input
                key={`uz:${a.titleUz}`}
                defaultValue={a.titleUz}
                maxLength={200}
                onBlur={(e) => void saveTitle("titleUz", e.currentTarget)}
                onKeyDown={onTitleKeyDown}
                data-testid="attachment-title-uz"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">{t("titleRu")}</span>
              <Input
                key={`ru:${a.titleRu}`}
                defaultValue={a.titleRu}
                maxLength={200}
                onBlur={(e) => void saveTitle("titleRu", e.currentTarget)}
                onKeyDown={onTitleKeyDown}
                data-testid="attachment-title-ru"
              />
            </label>
          </div>
        ) : (
          <p className="truncate text-sm font-medium text-ink">{a.titleUz || a.fileName}</p>
        )}

        <div className="text-xs text-slate-500">
          <p className="tabular-nums" data-testid="attachment-meta">
            {meta}
          </p>
          <p className="truncate" title={a.fileName}>
            {a.fileName}
          </p>
        </div>

        {ready ? (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <label className="flex w-fit items-center gap-3">
                <Switch
                  checked={allowDownload}
                  disabled={toggling}
                  onCheckedChange={(v) => toggleDownload(v)}
                  data-testid="attachment-allow-download"
                />
                <span className="text-sm text-ink">{t("attachmentAllowDownload")}</span>
              </label>
              {/* Save feedback for the switch and both titles, inline so the
                  row does not jump when it appears. */}
              <span aria-live="polite" className="text-xs" data-testid="attachment-save-state">
                {save.kind === "saving" && (
                  <span className="text-slate-500">{t("reorderSaving")}</span>
                )}
                {save.kind === "saved" && (
                  <span className="inline-flex items-center gap-1 text-success">
                    <Check className="size-3" aria-hidden /> {t("attachmentSaved")}
                  </span>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {allowDownload ? t("attachmentDownloadOn") : t("attachmentDownloadOff")}
            </p>
            {save.kind === "error" && (
              <p role="alert" className="text-sm text-danger">
                {save.message}
              </p>
            )}
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-danger">
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            {a.status === "failed" ? t("attachmentFailedStatus") : t("attachmentStuck")}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-start gap-1 sm:flex-col">
        <Button
          ref={moveButtonRef(-1)}
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
          aria-label={t("attachmentMoveUp")}
          title={t("attachmentMoveUp")}
        >
          <ArrowUp />
        </Button>
        <Button
          ref={moveButtonRef(1)}
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
          aria-label={t("attachmentMoveDown")}
          title={t("attachmentMoveDown")}
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-danger hover:text-danger"
          onClick={onDelete}
          data-testid="attachment-delete"
        >
          {t("attachmentDelete")}
        </Button>
      </div>
    </li>
  );
}

function QueueRow({
  item,
  hasLesson,
  formatBytes,
  onRetry,
  onRemove,
  onAllowDownload,
}: {
  item: QueueItem;
  hasLesson: boolean;
  formatBytes: (bytes: number) => string;
  onRetry: () => void;
  onRemove: () => void;
  onAllowDownload: (v: boolean) => void;
}) {
  const t = useTranslations("Studio");
  // null for a refused file of an unknown type: no kind label is shown.
  const kind = guessKind(item.file);
  const percent = Math.round(item.progress * 100);
  const inFlight = item.phase === "uploading" || item.phase === "finalizing";
  const errored = item.phase === "failed" || item.phase === "invalid";

  const status = (() => {
    switch (item.phase) {
      case "new":
        return t("attachmentPreparingStart");
      case "preparing":
        return item.prepTotal > 0
          ? t("attachmentPreparing", { done: item.prepDone, total: item.prepTotal })
          : t("attachmentPreparingStart");
      case "ready":
        return hasLesson ? t("attachmentWaiting") : t("attachmentQueued");
      case "uploading":
        return t("attachmentUploading", { percent });
      case "finalizing":
        return t("attachmentFinalizing");
      default:
        return null;
    }
  })();

  const bar =
    item.phase === "preparing" && item.prepTotal > 0
      ? item.prepDone / item.prepTotal
      : inFlight
        ? item.progress
        : null;

  return (
    <li
      data-testid="attachment-upload"
      data-phase={item.phase}
      className={cn(
        "flex items-start gap-3 rounded-md border bg-bg p-3",
        errored ? "border-danger/40" : "border-line",
      )}
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-surface">
        <KindIcon kind={kind} className="size-4 text-navy-600" />
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="truncate text-sm font-medium text-ink" title={item.file.name}>
          {item.file.name}
        </p>
        <p className="text-xs text-slate-500 tabular-nums">
          {[
            kind === "pdf" ? t("attachmentKindPdf") : kind === "image" ? t("attachmentKindImage") : null,
            item.slideCount > 0 ? t("attachmentSlides", { count: item.slideCount }) : null,
            formatBytes(item.file.size),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {status && (
          <p className="text-xs text-slate-500 tabular-nums" data-testid="attachment-upload-status">
            {status}
          </p>
        )}
        {bar !== null && (
          <div
            role="progressbar"
            aria-label={status ?? undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(bar * 100)}
            className="h-1.5 w-full overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-navy-600 transition-[width] duration-200"
              style={{ width: `${Math.round(bar * 100)}%` }}
            />
          </div>
        )}
        {errored && item.error && (
          <p role="alert" className="text-sm text-danger" data-testid="attachment-upload-error">
            {item.error}
          </p>
        )}

        {/* The download choice can be made up front, before the upload starts. */}
        {(item.phase === "ready" || item.phase === "new" || item.phase === "preparing") && !hasLesson && (
          <label className="flex w-fit items-center gap-3 pt-1">
            <Switch
              checked={item.allowDownload}
              onCheckedChange={(v) => onAllowDownload(v)}
              data-testid="attachment-queued-allow-download"
            />
            <span className="text-sm text-ink">{t("attachmentAllowDownload")}</span>
          </label>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {item.phase === "failed" && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RotateCw aria-hidden /> {t("attachmentRetry")}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={item.phase === "finalizing"}
          aria-label={inFlight ? t("attachmentCancelUpload") : t("attachmentRemove")}
          title={inFlight ? t("attachmentCancelUpload") : t("attachmentRemove")}
          data-testid="attachment-upload-remove"
        >
          <X />
        </Button>
      </div>
    </li>
  );
}

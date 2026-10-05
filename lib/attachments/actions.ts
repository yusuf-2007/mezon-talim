"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireCourseEditor } from "@/lib/content/access";
import { lessonAttachmentsRepository } from "@/lib/db/repositories/lesson-attachments";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { modulesRepository } from "@/lib/db/repositories/modules";
import type { LocalizedText } from "@/lib/db/schema";
import {
  deletePrefix,
  getAttachmentsBucket,
  getObjectBytes,
  getObjectHead,
  headObject,
  isAttachmentStorageConfigured,
  presignPost,
  type PresignedPost,
} from "@/lib/storage";
import { toStudioAttachment, type StudioAttachment } from "./dto";
import { attachmentStoragePrefix, originalKey, pageKey } from "./keys";
import {
  MAX_ATTACHMENTS_PER_LESSON,
  MAX_IMAGE_BYTES,
  MAX_PAGE_BYTES,
  MAX_PAGES,
  MAX_PDF_BYTES,
  SLIDE_LONG_EDGE,
  SLIDE_MIMES,
  SNIFF_BYTES,
  isAcceptedMime,
  kindForMime,
  maxBytesForKind,
  sniffAcceptedMime,
  withExtensionFor,
  type AttachmentKind,
  type SlideMime,
} from "./limits";
import { isDeclaredSlide } from "./verify";

/**
 * Studio / Admin actions for lesson attachments (slides under the video).
 *
 * Upload flow — the browser never streams files through the app (Vercel caps
 * request bodies at 4.5 MB):
 *   1. beginAttachmentUploadAction  → row in `uploading` + presigned POSTs
 *   2. the browser POSTs the original + every rendered slide to the bucket,
 *      renewing the POSTs (renewAttachmentUploadAction) before they expire
 *   3. finalizeAttachmentUploadAction → verifies the objects, flips to `ready`
 *
 * Every action authorizes the course (requireCourseEditor) AND checks that the
 * lesson / attachment really belongs to that course: authorizing course A must
 * never let an editor touch course B's lessons (same reasoning as
 * reorderLessonsAction). Returns are plain objects so client components can
 * call these directly.
 */

export type AttachmentErrorCode =
  | "storage_not_configured"
  | "invalid"
  | "bad_type"
  | "too_large"
  | "too_many_pages"
  | "too_many"
  | "not_found"
  | "upload_incomplete"
  | "not_an_image"
  | "stale"
  | "failed";

export type AttachmentActionError = {
  ok: false;
  code: AttachmentErrorCode;
  /** Localized, ready to show. */
  error: string;
};

export type BeginAttachmentUploadInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: "pdf" | "image";
  pageCount: number;
  /** Exact pixel size of each rendered slide, in page order. */
  pages: { w: number; h: number }[];
  /**
   * Format the slides were encoded in (default "image/webp"). Send
   * "image/jpeg" when canvas.toBlob could not produce WebP.
   */
  slideMime?: "image/webp" | "image/jpeg";
  allowDownload: boolean;
  titleUz?: string;
  titleRu?: string;
};

export type AttachmentUploadTargets = {
  /** POST target for the original file (Content-Type = mimeType). */
  original: PresignedPost;
  /** POST targets for slides 1..pageCount (Content-Type = slideMime). */
  pages: PresignedPost[];
  /** How long these targets stay valid from when they were handed out. */
  ttlSeconds: number;
};

export type BeginAttachmentUploadResult =
  | ({ ok: true; attachmentId: string } & AttachmentUploadTargets)
  | AttachmentActionError;

export type RenewAttachmentUploadResult =
  | ({ ok: true } & AttachmentUploadTargets)
  | AttachmentActionError;

export type AttachmentMutationResult =
  | { ok: true; attachment: StudioAttachment }
  | AttachmentActionError;

export type AttachmentActionResult = { ok: true } | AttachmentActionError;

export type UpdateAttachmentInput = {
  titleUz?: string;
  titleRu?: string;
  allowDownload?: boolean;
};

/**
 * Presigned upload lifetime. Covers a 50 MB original on a slow link; a whole
 * deck (original + up to 150 slides, sent one after another) can take longer,
 * so the client renews the targets before they run out rather than this
 * window being stretched to fit the worst case.
 */
const UPLOAD_TTL_SECONDS = 15 * 60;
/** Bound on parallel HEAD requests during finalize. */
const HEAD_CONCURRENCY = 8;
const MAX_TITLE = 200;
const MB = 1024 * 1024;

const uuid = z.uuid();

const pageSizeSchema = z.object({
  w: z.number().int().min(1).max(SLIDE_LONG_EDGE),
  h: z.number().int().min(1).max(SLIDE_LONG_EDGE),
});

const beginSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(100),
  sizeBytes: z.number().int().min(1),
  kind: z.enum(["pdf", "image"]),
  pageCount: z.number().int().min(1),
  // Structural cap only; the real MAX_PAGES check gives its own message.
  pages: z.array(pageSizeSchema).min(1).max(1000),
  slideMime: z.enum(SLIDE_MIMES).default("image/webp"),
  allowDownload: z.boolean().default(false),
  titleUz: z.string().trim().max(MAX_TITLE).optional(),
  titleRu: z.string().trim().max(MAX_TITLE).optional(),
});

const updateSchema = z.object({
  titleUz: z.string().trim().min(1).max(MAX_TITLE).optional(),
  titleRu: z.string().trim().max(MAX_TITLE).optional(),
  allowDownload: z.boolean().optional(),
});

const reorderIdsSchema = z.array(z.uuid()).min(1).max(MAX_ATTACHMENTS_PER_LESSON * 2);

async function fail(code: AttachmentErrorCode): Promise<AttachmentActionError> {
  const t = await getTranslations("Studio");
  const error = (() => {
    switch (code) {
      case "storage_not_configured":
        return t("attachmentErrStorage");
      case "bad_type":
        return t("attachmentErrType");
      case "too_large":
        return t("attachmentErrTooLarge", {
          pdfMb: MAX_PDF_BYTES / MB,
          imageMb: MAX_IMAGE_BYTES / MB,
        });
      case "too_many_pages":
        return t("attachmentErrTooManyPages", { max: MAX_PAGES });
      case "too_many":
        return t("attachmentErrTooMany", { max: MAX_ATTACHMENTS_PER_LESSON });
      case "not_found":
        return t("attachmentErrNotFound");
      case "upload_incomplete":
        return t("attachmentErrIncomplete");
      case "not_an_image":
        return t("attachmentErrNotImage");
      case "stale":
        return t("reorderStale");
      case "failed":
        return t("attachmentErrFailed");
      case "invalid":
      default:
        return t("attachmentErrInvalid");
    }
  })();
  return { ok: false, code, error };
}

/**
 * Refresh both authoring surfaces (Studio and Admin render the same
 * CourseEditor at different paths — see revalidateCourse in lib/content).
 */
function revalidateCourse(courseId: string): void {
  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}`);
}

/** The lesson exists (not soft-deleted) and sits in `courseId`. */
async function lessonInCourse(lessonId: string, courseId: string): Promise<boolean> {
  const lesson = await lessonsRepository.findById(lessonId);
  if (!lesson) return false;
  const parentModule = await modulesRepository.findById(lesson.moduleId);
  return parentModule?.courseId === courseId;
}

/** The attachment, if its lesson is live and belongs to `courseId`. */
async function attachmentInCourse(attachmentId: string, courseId: string) {
  const row = await lessonAttachmentsRepository.findById(attachmentId);
  if (!row) return null;
  return (await lessonInCourse(row.lessonId, courseId)) ? row : null;
}

/**
 * File name as given, minus anything that could act as a path or header, and
 * minus invisible format characters (\p{Cf}: bidi overrides, zero-width
 * marks) — "Lecture\u202Efdp.exe" would otherwise display as "Lectureexe.pdf".
 */
function cleanFileName(name: string): string {
  return name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\p{Cf}/gu, "")
    .replace(/[/\\]/g, "_")
    .trim();
}

/** "Lecture 3.final.pdf" → "Lecture 3.final" */
function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.trim().slice(0, MAX_TITLE) || name.slice(0, MAX_TITLE);
}

function loc(uz: string, ru?: string): LocalizedText {
  return ru && ru.length > 0 ? { uz, ru } : { uz };
}

/**
 * Presigned POSTs for every object of an attachment, all valid for
 * UPLOAD_TTL_SECONDS from now. The keys are derived from the row, so begin and
 * renew hand out targets for exactly the same objects.
 */
async function signUploadTargets(row: {
  storagePrefix: string;
  mimeType: string;
  kind: AttachmentKind;
  pageCount: number;
  slideMime: SlideMime;
}): Promise<AttachmentUploadTargets> {
  const bucket = getAttachmentsBucket();
  const [original, ...pages] = await Promise.all([
    presignPost({
      bucket,
      key: originalKey(row.storagePrefix),
      contentType: row.mimeType,
      maxBytes: maxBytesForKind(row.kind),
      ttlSeconds: UPLOAD_TTL_SECONDS,
    }),
    ...Array.from({ length: row.pageCount }, (_, i) =>
      presignPost({
        bucket,
        key: pageKey(row.storagePrefix, i + 1, row.slideMime),
        contentType: row.slideMime,
        maxBytes: MAX_PAGE_BYTES,
        ttlSeconds: UPLOAD_TTL_SECONDS,
      }),
    ),
  ]);
  return { original, pages, ttlSeconds: UPLOAD_TTL_SECONDS };
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

// ── Begin ────────────────────────────────────────────────────────────────────

export async function beginAttachmentUploadAction(
  courseId: string,
  lessonId: string,
  input: BeginAttachmentUploadInput,
): Promise<BeginAttachmentUploadResult> {
  if (!uuid.safeParse(courseId).success || !uuid.safeParse(lessonId).success) {
    return fail("invalid");
  }
  const { user } = await requireCourseEditor(courseId);
  if (!isAttachmentStorageConfigured()) return fail("storage_not_configured");

  const parsed = beginSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const d = parsed.data;

  const mimeType = d.mimeType;
  if (!isAcceptedMime(mimeType) || kindForMime(mimeType) !== d.kind) return fail("bad_type");
  if (d.sizeBytes > maxBytesForKind(d.kind)) return fail("too_large");
  if (d.pageCount > MAX_PAGES) return fail("too_many_pages");
  if (d.pages.length !== d.pageCount) return fail("invalid");
  if (d.kind === "image" && d.pageCount !== 1) return fail("invalid");

  if (!(await lessonInCourse(lessonId, courseId))) return fail("not_found");

  const givenName = cleanFileName(d.fileName);
  if (!givenName) return fail("invalid");
  // Stored (and later downloaded) under an extension that matches the type;
  // the default title still comes from the name the teacher gave.
  const fileName = withExtensionFor(givenName, mimeType);

  const id = randomUUID();
  const storagePrefix = attachmentStoragePrefix(lessonId, id);
  const row = await lessonAttachmentsRepository.create(
    {
      id,
      lessonId,
      title: loc(d.titleUz || titleFromFileName(givenName), d.titleRu),
      kind: d.kind,
      fileName,
      mimeType,
      sizeBytes: d.sizeBytes,
      pageCount: d.pageCount,
      pages: d.pages,
      slideMime: d.slideMime,
      storagePrefix,
      allowDownload: d.allowDownload,
      createdBy: user.id,
    },
    { maxPerLesson: MAX_ATTACHMENTS_PER_LESSON },
  );
  // The lesson was checked just above, so a null here is the per-lesson cap.
  if (!row) return fail("too_many");

  try {
    const targets = await signUploadTargets(row);
    revalidateCourse(courseId);
    return { ok: true, attachmentId: id, ...targets };
  } catch (err) {
    console.error("[attachments] presign failed", err);
    await lessonAttachmentsRepository.delete(id);
    return fail("failed");
  }
}

// ── Renew ────────────────────────────────────────────────────────────────────

/**
 * Fresh upload targets for an attachment that is still uploading. Begin's
 * targets all expire UPLOAD_TTL_SECONDS after begin, and the client sends the
 * parts one after another, so a large deck on a slow link can outlive them;
 * the client renews before they run out instead of failing near the end.
 * Same keys and same pins as begin. Refused once the attachment has left
 * `uploading`, so slides that finalize verified cannot be replaced this way.
 */
export async function renewAttachmentUploadAction(
  courseId: string,
  attachmentId: string,
): Promise<RenewAttachmentUploadResult> {
  if (!uuid.safeParse(courseId).success || !uuid.safeParse(attachmentId).success) {
    return fail("invalid");
  }
  await requireCourseEditor(courseId);
  if (!isAttachmentStorageConfigured()) return fail("storage_not_configured");

  const row = await attachmentInCourse(attachmentId, courseId);
  if (!row) return fail("not_found");
  if (row.status !== "uploading") return fail("invalid");

  try {
    return { ok: true, ...(await signUploadTargets(row)) };
  } catch (err) {
    console.error("[attachments] presign (renew) failed", err);
    return fail("failed");
  }
}

// ── Finalize ─────────────────────────────────────────────────────────────────

/**
 * Verify every expected object landed (sizes + content types), sniff the
 * original's first bytes to prove it is the declared type, check the first
 * slide's header to prove it is a real image of the declared format and size,
 * then mark the attachment `ready`. Idempotent: a ready attachment returns
 * as-is; a failed one is re-verified (so a transient error can simply be
 * retried). The slide route checks every slide again when it serves it, so
 * this is the early, friendly refusal, not the only one.
 */
export async function finalizeAttachmentUploadAction(
  courseId: string,
  attachmentId: string,
): Promise<AttachmentMutationResult> {
  if (!uuid.safeParse(courseId).success || !uuid.safeParse(attachmentId).success) {
    return fail("invalid");
  }
  await requireCourseEditor(courseId);
  if (!isAttachmentStorageConfigured()) return fail("storage_not_configured");

  const row = await attachmentInCourse(attachmentId, courseId);
  if (!row) return fail("not_found");
  if (row.status === "ready") return { ok: true, attachment: toStudioAttachment(row) };

  const bucket = getAttachmentsBucket();
  const markFailed = async (code: AttachmentErrorCode) => {
    await lessonAttachmentsRepository.setStatus(row.id, "failed");
    revalidateCourse(courseId);
    return fail(code);
  };

  try {
    const original = await headObject(originalKey(row.storagePrefix), bucket);
    if (!original || original.size !== row.sizeBytes || original.contentType !== row.mimeType) {
      return markFailed("upload_incomplete");
    }
    // The Content-Type above is the label the upload policy pinned, not the
    // bytes; the allowlist only means something if the bytes agree with it.
    const head = await getObjectHead(originalKey(row.storagePrefix), SNIFF_BYTES, bucket);
    if (!head) return markFailed("upload_incomplete");
    if (sniffAcceptedMime(head) !== row.mimeType) return markFailed("bad_type");

    const pageNumbers = Array.from({ length: row.pageCount }, (_, i) => i + 1);
    const heads = await mapPool(pageNumbers, HEAD_CONCURRENCY, (n) =>
      headObject(pageKey(row.storagePrefix, n, row.slideMime), bucket),
    );
    const allPagesOk = heads.every(
      (h) => h && h.size > 0 && h.size <= MAX_PAGE_BYTES && h.contentType === row.slideMime,
    );
    if (!allPagesOk) return markFailed("upload_incomplete");

    const first = await getObjectBytes(pageKey(row.storagePrefix, 1, row.slideMime), bucket);
    if (!first) return markFailed("upload_incomplete");
    const declared = row.pages[0];
    if (!(await isDeclaredSlide(first, { mime: row.slideMime, w: declared.w, h: declared.h }))) {
      return markFailed("not_an_image");
    }
  } catch (err) {
    // Storage unreachable: leave the status alone so a retry can succeed.
    console.error("[attachments] finalize failed", err);
    return fail("failed");
  }

  const ready = await lessonAttachmentsRepository.setStatus(row.id, "ready");
  if (!ready) return fail("not_found");
  revalidateCourse(courseId);
  return { ok: true, attachment: toStudioAttachment(ready) };
}

// ── Edit / reorder / delete ──────────────────────────────────────────────────

/** Rename (uz/ru) and/or flip "allow download". Applies immediately. */
export async function updateAttachmentAction(
  courseId: string,
  attachmentId: string,
  input: UpdateAttachmentInput,
): Promise<AttachmentMutationResult> {
  if (!uuid.safeParse(courseId).success || !uuid.safeParse(attachmentId).success) {
    return fail("invalid");
  }
  await requireCourseEditor(courseId);
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const d = parsed.data;

  const row = await attachmentInCourse(attachmentId, courseId);
  if (!row) return fail("not_found");

  const titleChanged = d.titleUz !== undefined || d.titleRu !== undefined;
  const updated = await lessonAttachmentsRepository.update(row.id, {
    ...(titleChanged
      ? {
          title: loc(
            d.titleUz ?? row.title.uz,
            d.titleRu !== undefined ? d.titleRu : row.title.ru,
          ),
        }
      : {}),
    ...(d.allowDownload !== undefined ? { allowDownload: d.allowDownload } : {}),
  });
  if (!updated) return fail("not_found");
  revalidateCourse(courseId);
  return { ok: true, attachment: toStudioAttachment(updated) };
}

/**
 * Persist a new order for one lesson's attachments. `ids` must be exactly the
 * lesson's current attachments (any status) — a partial or stale list is
 * refused rather than leaving duplicate or gapped order_index values.
 */
export async function reorderAttachmentsAction(
  courseId: string,
  lessonId: string,
  ids: string[],
): Promise<AttachmentActionResult> {
  if (!uuid.safeParse(courseId).success || !uuid.safeParse(lessonId).success) {
    return fail("invalid");
  }
  await requireCourseEditor(courseId);
  const parsed = reorderIdsSchema.safeParse(ids);
  if (!parsed.success) return fail("invalid");
  if (!(await lessonInCourse(lessonId, courseId))) return fail("not_found");

  const current = await lessonAttachmentsRepository.listByLesson(lessonId);
  const currentIds = new Set(current.map((a) => a.id));
  const nextIds = new Set(parsed.data);
  const sameSet =
    nextIds.size === parsed.data.length &&
    nextIds.size === currentIds.size &&
    [...nextIds].every((id) => currentIds.has(id));
  if (!sameSet) return fail("stale");

  await lessonAttachmentsRepository.reorder(lessonId, parsed.data);
  revalidateCourse(courseId);
  return { ok: true };
}

/** Hard delete: stored objects first (best effort), then the row. */
export async function deleteAttachmentAction(
  courseId: string,
  attachmentId: string,
): Promise<AttachmentActionResult> {
  if (!uuid.safeParse(courseId).success || !uuid.safeParse(attachmentId).success) {
    return fail("invalid");
  }
  await requireCourseEditor(courseId);
  const row = await attachmentInCourse(attachmentId, courseId);
  if (!row) return fail("not_found");

  if (isAttachmentStorageConfigured()) {
    const removed = await deletePrefix(`${row.storagePrefix}/`, getAttachmentsBucket());
    if (!removed) {
      // Orphaned bytes cost storage, not correctness: nothing serves them
      // once the row is gone.
      console.error(`[attachments] could not remove objects under ${row.storagePrefix}/`);
    }
  }
  await lessonAttachmentsRepository.delete(row.id);
  revalidateCourse(courseId);
  return { ok: true };
}

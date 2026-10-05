/**
 * Lesson-attachment shapes handed to client components, plus the URL builders
 * for the serving routes. Pure (no server-only imports) so both server and
 * client code can use it. Never put storage keys, bucket names or presigned GET URLs in
 * these shapes — the student client only ever talks to /api/attachments/*.
 */
import { pickLocale } from "@/lib/i18n/localized";
import type { AttachmentKind } from "./limits";

export type AttachmentPageSize = { w: number; h: number };
export type AttachmentStatus = "uploading" | "ready" | "failed";

/** What the Studio / Admin lesson form renders for one attachment. */
export type StudioAttachment = {
  id: string;
  lessonId: string;
  orderIndex: number;
  titleUz: string;
  titleRu: string;
  kind: AttachmentKind;
  status: AttachmentStatus;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  pages: AttachmentPageSize[];
  allowDownload: boolean;
  /** First-slide thumbnail (only meaningful when status is "ready"). */
  thumbUrl: string;
};

/** What the student viewer renders for one deck (ready attachments only). */
export type LessonSlideDeck = {
  id: string;
  /** Already localized for the viewer. */
  title: string;
  kind: AttachmentKind;
  pageCount: number;
  pages: AttachmentPageSize[];
  allowDownload: boolean;
  /** Present only when allowDownload: the original's name and download route. */
  download: { fileName: string; sizeBytes: number; url: string } | null;
};

/** Slide n (1-based). `thumb` serves a THUMB_WIDTH-wide version. */
export function attachmentPageUrl(attachmentId: string, page: number, thumb = false): string {
  return `/api/attachments/${attachmentId}/pages/${page}${thumb ? "?size=thumb" : ""}`;
}

/** Download route — 403 unless the attachment allows downloads. */
export function attachmentDownloadUrl(attachmentId: string): string {
  return `/api/attachments/${attachmentId}/download`;
}

/** Structural row shape (kept local so this file stays client-safe). */
type AttachmentRowLike = {
  id: string;
  lessonId: string;
  orderIndex: number;
  title: { uz: string; ru?: string };
  kind: AttachmentKind;
  status: AttachmentStatus;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  pages: AttachmentPageSize[];
  allowDownload: boolean;
};

export function toStudioAttachment(row: AttachmentRowLike): StudioAttachment {
  return {
    id: row.id,
    lessonId: row.lessonId,
    orderIndex: row.orderIndex,
    titleUz: row.title.uz,
    titleRu: row.title.ru ?? "",
    kind: row.kind,
    status: row.status,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    pageCount: row.pageCount,
    pages: row.pages,
    allowDownload: row.allowDownload,
    thumbUrl: attachmentPageUrl(row.id, 1, true),
  };
}

export function toSlideDeck(row: AttachmentRowLike, locale: string): LessonSlideDeck {
  return {
    id: row.id,
    title: pickLocale(row.title, locale),
    kind: row.kind,
    pageCount: row.pageCount,
    pages: row.pages,
    allowDownload: row.allowDownload,
    download: row.allowDownload
      ? { fileName: row.fileName, sizeBytes: row.sizeBytes, url: attachmentDownloadUrl(row.id) }
      : null,
  };
}

/**
 * Lesson-attachment limits, shared by the Studio client (early, friendly
 * validation) and the server actions (the real gate). Keep this file free of
 * server-only imports — it is bundled into the browser.
 */

export const ACCEPTED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export type AcceptedMime = (typeof ACCEPTED_MIME)[number];

export const IMAGE_MIME = ["image/png", "image/jpeg", "image/webp"] as const;

export type AttachmentKind = "pdf" | "image";

const MB = 1024 * 1024;

/** Original-file caps per kind. */
export const MAX_PDF_BYTES = 50 * MB;
export const MAX_IMAGE_BYTES = 15 * MB;
/** Slides per attachment (PDF pages). */
export const MAX_PAGES = 150;
/** One rendered slide (WebP). */
export const MAX_PAGE_BYTES = 4 * MB;
export const MAX_ATTACHMENTS_PER_LESSON = 20;
/**
 * Slides are rendered so their long edge is this many pixels (never upscaled
 * past 2× the PDF page). The server refuses declared sizes above it.
 */
export const SLIDE_LONG_EDGE = 1920;
/** Thumbnail width served by `?size=thumb`. */
export const THUMB_WIDTH = 360;
/**
 * Formats a rendered slide may be uploaded in. WebP is the default; JPEG is
 * the fallback when the browser's canvas cannot encode WebP (`toBlob` hands
 * back a PNG instead — Safari). Declare the one actually produced.
 */
export const SLIDE_MIMES = ["image/webp", "image/jpeg"] as const;
export type SlideMime = (typeof SLIDE_MIMES)[number];
export const DEFAULT_SLIDE_MIME: SlideMime = "image/webp";

/** File extension used in the slide's storage key. */
export function slideExtension(mime: SlideMime): "webp" | "jpg" {
  return mime === "image/jpeg" ? "jpg" : "webp";
}

export function isAcceptedMime(mime: string): mime is AcceptedMime {
  return (ACCEPTED_MIME as readonly string[]).includes(mime);
}

/** The kind a MIME type must be uploaded as, or null when not accepted. */
export function kindForMime(mime: string): AttachmentKind | null {
  if (mime === "application/pdf") return "pdf";
  if ((IMAGE_MIME as readonly string[]).includes(mime)) return "image";
  return null;
}

/** Original-file size cap for a kind. */
export function maxBytesForKind(kind: AttachmentKind): number {
  return kind === "pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
}

/** Bytes `sniffAcceptedMime` needs from the start of a file. */
export const SNIFF_BYTES = 16;

/**
 * A file's real type from its first bytes, or null when it is none of
 * ACCEPTED_MIME. A declared type (the browser's `file.type`, an upload's
 * Content-Type) is only a label; this is the one rule both the Studio (before
 * rendering) and the server (finalize, every slide served) check the bytes by.
 */
export function sniffAcceptedMime(head: Uint8Array): AcceptedMime | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (head[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Extensions a stored file name may end in, per type; the first is the one added. */
const EXTENSIONS: Record<AcceptedMime, readonly string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
};

/**
 * `name` ending in an extension that matches `mime`: kept as is when it
 * already does, otherwise the type's extension is appended
 * ("notes.exe" → "notes.exe.pdf"). A download is saved under this name, and
 * the extension is what decides how the student's computer opens it, so it
 * must agree with the type the server checked.
 */
export function withExtensionFor(name: string, mime: AcceptedMime): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const allowed = EXTENSIONS[mime];
  return allowed.includes(ext) ? name : `${name}.${allowed[0]}`;
}

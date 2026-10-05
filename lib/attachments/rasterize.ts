/**
 * Client-only: turns a teacher's PDF or image into slide images, in the
 * browser, at upload time (the server has no native PDF renderer — see the
 * attachments spec). Imported only by Studio client components; pdf.js is
 * loaded on demand so it never weighs on any other page.
 *
 * Output contract (checked again by finalizeAttachmentUploadAction):
 *  - one slide per PDF page / one per image, long edge ≤ SLIDE_LONG_EDGE
 *    (PDF pages are never scaled past 2×, images are never upscaled);
 *  - painted on white first, so transparent images match what the server
 *    renders;
 *  - WebP (quality 0.82). Safari's canvas cannot encode WebP — `toBlob`
 *    silently hands back a PNG — so when that happens the whole attachment
 *    switches to JPEG and says so in `slideMime` (one format per attachment);
 *  - `w`/`h` are the exact canvas size of each slide;
 *  - every slide ≤ MAX_PAGE_BYTES.
 *
 * Drawing through a canvas also strips the image's EXIF/metadata from the
 * slides students see. The original file is uploaded untouched beside them
 * (private; only served when the attachment allows downloads).
 */
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  MAX_PAGE_BYTES,
  MAX_PAGES,
  SLIDE_LONG_EDGE,
  SNIFF_BYTES,
  maxBytesForKind,
  sniffAcceptedMime,
  type AcceptedMime,
  type AttachmentKind,
  type SlideMime,
} from "./limits";

export type RasterizeErrorCode =
  | "bad_type"
  | "too_large"
  | "too_many_pages"
  | "password"
  | "unreadable"
  | "slide_too_large"
  | "aborted";

export class RasterizeError extends Error {
  readonly code: RasterizeErrorCode;
  constructor(code: RasterizeErrorCode, cause?: unknown) {
    super(`rasterize: ${code}`, cause === undefined ? undefined : { cause });
    this.name = "RasterizeError";
    this.code = code;
  }
}

export type RenderedSlide = { blob: Blob; w: number; h: number };

export type PreparedAttachment = {
  file: File;
  /** Sniffed from the file's bytes, not trusted from its extension. */
  mimeType: AcceptedMime;
  kind: AttachmentKind;
  slideMime: SlideMime;
  slides: RenderedSlide[];
};

export type RasterizeOptions = {
  signal?: AbortSignal;
  /** Called after each slide is encoded: (done, total). */
  onProgress?: (done: number, total: number) => void;
};

const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.85;
/** Re-encode at these qualities if a slide comes out above MAX_PAGE_BYTES. */
const FALLBACK_QUALITIES = [0.7, 0.55];
/** Never render a PDF page past this zoom (a tiny page stays sharp, not huge). */
const MAX_PDF_SCALE = 2;

// ── Type sniffing ────────────────────────────────────────────────────────────

/**
 * The file's real type from its first bytes. The browser's `file.type` comes
 * from the extension, so a renamed file would otherwise be uploaded under a
 * type it is not.
 */
async function sniffMime(file: File): Promise<AcceptedMime | null> {
  return sniffAcceptedMime(new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer()));
}

/**
 * Quick checks that need no decoding: the bytes are an accepted type and the
 * file is within its kind's size cap. Throws RasterizeError.
 */
export async function checkAttachmentFile(
  file: File,
): Promise<{ mimeType: AcceptedMime; kind: AttachmentKind }> {
  let mimeType: AcceptedMime | null;
  try {
    mimeType = await sniffMime(file);
  } catch (err) {
    throw new RasterizeError("unreadable", err);
  }
  if (!mimeType) throw new RasterizeError("bad_type");
  const kind: AttachmentKind = mimeType === "application/pdf" ? "pdf" : "image";
  if (file.size < 1 || file.size > maxBytesForKind(kind)) {
    throw new RasterizeError("too_large");
  }
  return { mimeType, kind };
}

// ── Encoding ─────────────────────────────────────────────────────────────────

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new RasterizeError("unreadable"))),
      type,
      quality,
    );
  });
}

/**
 * Encodes the canvas in the attachment's slide format. The first call decides
 * the format: WebP if the browser really produced WebP, JPEG otherwise.
 */
class SlideEncoder {
  mime: SlideMime | null = null;

  async encode(canvas: HTMLCanvasElement): Promise<Blob> {
    if (this.mime === null) {
      const probe = await toBlob(canvas, "image/webp", WEBP_QUALITY);
      if (probe.type === "image/webp") {
        this.mime = "image/webp";
        return this.fit(canvas, probe);
      }
      this.mime = "image/jpeg";
    }
    const blob = await toBlob(
      canvas,
      this.mime,
      this.mime === "image/webp" ? WEBP_QUALITY : JPEG_QUALITY,
    );
    return this.fit(canvas, blob);
  }

  /** Step the quality down until the slide fits MAX_PAGE_BYTES. */
  private async fit(canvas: HTMLCanvasElement, blob: Blob): Promise<Blob> {
    let out = blob;
    for (const q of FALLBACK_QUALITIES) {
      if (out.size <= MAX_PAGE_BYTES) break;
      out = await toBlob(canvas, this.mime!, q);
    }
    if (out.size > MAX_PAGE_BYTES || out.type !== this.mime) {
      throw new RasterizeError("slide_too_large");
    }
    return out;
  }
}

function newCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new RasterizeError("unreadable");
  return { canvas, ctx };
}

/** Free the canvas's backing store now rather than whenever GC gets to it. */
function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

function sizeCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): { w: number; h: number } {
  const w = Math.min(SLIDE_LONG_EDGE, Math.max(1, Math.floor(width)));
  const h = Math.min(SLIDE_LONG_EDGE, Math.max(1, Math.floor(height)));
  canvas.width = w;
  canvas.height = h;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  return { w, h };
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new RasterizeError("aborted");
}

// ── PDF ──────────────────────────────────────────────────────────────────────

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

/**
 * pdf.js, loaded once on first use. The legacy build is used on purpose: the
 * modern one leans on brand-new built-ins (Map#getOrInsert, Math.sumPrecise…)
 * that a teacher's slightly older browser may not have.
 */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").catch((err) => {
    pdfjsPromise = null; // let a later attempt retry the chunk load
    throw err;
  }) as Promise<PdfJs>;
  return pdfjsPromise;
}

/**
 * A dedicated worker per document, terminated afterwards. Created with
 * `new Worker(new URL(…, import.meta.url))` so the bundler (Turbopack in dev
 * and build) emits pdf.js's worker as its own chunk; there is no global
 * `workerSrc` to keep in sync with the installed version.
 */
function startPdfWorker(): Worker {
  return new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), {
    type: "module",
  });
}

async function rasterizePdf(
  file: File,
  encoder: SlideEncoder,
  opts: RasterizeOptions,
): Promise<RenderedSlide[]> {
  const pdfjs = await loadPdfJs();
  throwIfAborted(opts.signal);

  const data = new Uint8Array(await file.arrayBuffer());
  throwIfAborted(opts.signal);

  const port = startPdfWorker();
  const pdfWorker = pdfjs.PDFWorker.create({ port });
  let loadingTask: PDFDocumentLoadingTask | null = null;
  let doc: PDFDocumentProxy | null = null;
  let renderTask: RenderTask | null = null;
  const { canvas, ctx } = newCanvas();

  const onAbort = () => {
    renderTask?.cancel();
    void loadingTask?.destroy();
  };
  opts.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    // pdf.js 6 no longer compiles font programs with eval, so there is no
    // isEvalSupported switch left to turn off.
    loadingTask = pdfjs.getDocument({ data, worker: pdfWorker });
    try {
      doc = await loadingTask.promise;
    } catch (err) {
      throwIfAborted(opts.signal);
      const name = (err as { name?: string } | null)?.name;
      throw new RasterizeError(name === "PasswordException" ? "password" : "unreadable", err);
    }

    const total = doc.numPages;
    if (total < 1) throw new RasterizeError("unreadable");
    if (total > MAX_PAGES) throw new RasterizeError("too_many_pages");
    opts.onProgress?.(0, total);

    const slides: RenderedSlide[] = [];
    for (let n = 1; n <= total; n++) {
      throwIfAborted(opts.signal);
      const page = await doc.getPage(n);
      try {
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(
          SLIDE_LONG_EDGE / Math.max(base.width, base.height),
          MAX_PDF_SCALE,
        );
        const viewport = page.getViewport({ scale });
        const size = sizeCanvas(canvas, ctx, viewport.width, viewport.height);
        renderTask = page.render({ canvas, canvasContext: ctx, viewport, background: "#ffffff" });
        await renderTask.promise;
        renderTask = null;
        throwIfAborted(opts.signal);
        slides.push({ blob: await encoder.encode(canvas), ...size });
      } finally {
        page.cleanup();
      }
      opts.onProgress?.(n, total);
    }
    return slides;
  } catch (err) {
    if (opts.signal?.aborted) throw new RasterizeError("aborted", err);
    if (err instanceof RasterizeError) throw err;
    throw new RasterizeError("unreadable", err);
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
    releaseCanvas(canvas);
    // The loading task owns the document; the PDFWorker was passed in, so it
    // is ours to destroy, and terminate() makes sure the thread is gone even
    // if pdf.js never finished starting it.
    await loadingTask?.destroy().catch(() => {});
    pdfWorker.destroy();
    port.terminate();
  }
}

// ── Image ────────────────────────────────────────────────────────────────────

async function rasterizeImage(
  file: File,
  encoder: SlideEncoder,
  opts: RasterizeOptions,
): Promise<RenderedSlide[]> {
  let bitmap: ImageBitmap;
  try {
    // "from-image" applies the EXIF orientation, so a phone photo is upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (err) {
    throw new RasterizeError("unreadable", err);
  }
  const { canvas, ctx } = newCanvas();
  try {
    throwIfAborted(opts.signal);
    opts.onProgress?.(0, 1);
    const scale = Math.min(1, SLIDE_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const size = sizeCanvas(
      canvas,
      ctx,
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
    );
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, size.w, size.h);
    const blob = await encoder.encode(canvas);
    opts.onProgress?.(1, 1);
    return [{ blob, ...size }];
  } finally {
    bitmap.close();
    releaseCanvas(canvas);
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * Validate a file and render its slides. Throws RasterizeError (code
 * "aborted" when `signal` fired). Work is strictly sequential — one page in
 * memory at a time, on a single reused canvas.
 */
export async function rasterizeAttachment(
  file: File,
  opts: RasterizeOptions = {},
): Promise<PreparedAttachment> {
  if (typeof document === "undefined") {
    throw new Error("rasterizeAttachment runs in the browser only");
  }
  throwIfAborted(opts.signal);
  const { mimeType, kind } = await checkAttachmentFile(file);
  throwIfAborted(opts.signal);

  const encoder = new SlideEncoder();
  const slides =
    kind === "pdf"
      ? await rasterizePdf(file, encoder, opts)
      : await rasterizeImage(file, encoder, opts);

  return { file, mimeType, kind, slideMime: encoder.mime ?? "image/webp", slides };
}

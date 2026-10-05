/**
 * Client-only: uploads one prepared attachment (original + rendered slides)
 * straight to the bucket over the presigned POSTs that
 * beginAttachmentUploadAction hands out, then asks the server to verify it.
 * The app server never sees the file bytes (Vercel caps request bodies at
 * 4.5 MB). Used by the Studio's LessonAttachmentsField.
 */
import {
  beginAttachmentUploadAction,
  deleteAttachmentAction,
  finalizeAttachmentUploadAction,
  renewAttachmentUploadAction,
  type AttachmentUploadTargets,
} from "./actions";
import type { StudioAttachment } from "./dto";
import type { PreparedAttachment } from "./rasterize";

type PostTarget = { url: string; fields: Record<string, string> };

/**
 * Renew the upload targets once less than this is left on them, so the next
 * part never starts on a policy about to expire (a 4 MB slide takes ~30 s at
 * 1 Mbit/s; the policy is checked when the request arrives).
 */
const RENEW_MARGIN_MS = 2 * 60_000;

/** The server refused to renew the targets; `error` is already localized. */
class RenewRefusedError extends Error {
  constructor(readonly localized: string) {
    super("upload: renew refused");
    this.name = "RenewRefusedError";
  }
}

export type BucketUploadErrorCode = "network" | "rejected" | "aborted";

export class BucketUploadError extends Error {
  readonly code: BucketUploadErrorCode;
  readonly status: number;
  constructor(code: BucketUploadErrorCode, status = 0) {
    super(`upload: ${code}${status ? ` (${status})` : ""}`);
    this.name = "BucketUploadError";
    this.code = code;
    this.status = status;
  }
}

/**
 * One multipart POST to the bucket. XHR rather than fetch because fetch still
 * has no upload progress. The policy fields go first and `file` last — S3 and
 * MinIO ignore anything after the file part.
 */
export function postToBucket(
  target: PostTarget,
  body: Blob,
  opts: { signal?: AbortSignal; onProgress?: (loaded: number) => void } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new BucketUploadError("aborted"));
      return;
    }
    const form = new FormData();
    for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
    form.append("file", body);

    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    const done = () => opts.signal?.removeEventListener("abort", onAbort);

    xhr.open("POST", target.url);
    xhr.upload.onprogress = (e) => {
      // e.loaded counts the multipart envelope too; cap at the file's size so
      // the bar never runs past 100% of what the teacher sees.
      if (e.lengthComputable) opts.onProgress?.(Math.min(body.size, e.loaded));
    };
    xhr.onload = () => {
      done();
      if (xhr.status >= 200 && xhr.status < 300) {
        opts.onProgress?.(body.size);
        resolve();
      } else {
        reject(new BucketUploadError("rejected", xhr.status));
      }
    };
    xhr.onerror = () => {
      done();
      reject(new BucketUploadError("network"));
    };
    xhr.onabort = () => {
      done();
      reject(new BucketUploadError("aborted"));
    };
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    xhr.send(form);
  });
}

export type UploadOutcome =
  | { ok: true; attachment: StudioAttachment }
  | { ok: false; aborted: true }
  /** `error` is already localized (server message) unless `clientCode` is set. */
  | { ok: false; aborted: false; error?: string; clientCode?: "network" | "rejected" };

/**
 * begin → POST original → POST every slide (in order) → finalize.
 *
 * Begin's targets are valid for a fixed window, and a big deck on a slow link
 * can take longer than that to send part by part, so they are renewed before
 * they run out (and once more for a part refused with 403, in case the clock
 * jumped — a laptop that slept mid-upload). Without that, every retry of such
 * a deck would fail at the same point.
 *
 * Progress is reported as a 0..1 fraction of all bytes. On any failure after
 * begin, the half-made attachment is deleted (best effort) so no stuck row is
 * left behind; a retry simply starts over with fresh upload URLs.
 */
export async function uploadPreparedAttachment(input: {
  courseId: string;
  lessonId: string;
  prepared: PreparedAttachment;
  allowDownload: boolean;
  signal: AbortSignal;
  onBegun?: (attachmentId: string) => void;
  onProgress?: (fraction: number) => void;
  onFinalizing?: () => void;
}): Promise<UploadOutcome> {
  const { courseId, lessonId, prepared, signal } = input;
  if (signal.aborted) return { ok: false, aborted: true };

  let begin: Awaited<ReturnType<typeof beginAttachmentUploadAction>>;
  try {
    begin = await beginAttachmentUploadAction(courseId, lessonId, {
      fileName: prepared.file.name,
      mimeType: prepared.mimeType,
      sizeBytes: prepared.file.size,
      kind: prepared.kind,
      pageCount: prepared.slides.length,
      pages: prepared.slides.map((s) => ({ w: s.w, h: s.h })),
      slideMime: prepared.slideMime,
      allowDownload: input.allowDownload,
    });
  } catch {
    return { ok: false, aborted: false, clientCode: "network" };
  }
  if (!begin.ok) return { ok: false, aborted: false, error: begin.error };

  const attachmentId = begin.attachmentId;
  const discard = () => {
    // Fire-and-forget: the component may already be gone.
    void deleteAttachmentAction(courseId, attachmentId).catch(() => {});
  };
  if (signal.aborted) {
    discard();
    return { ok: false, aborted: true };
  }
  input.onBegun?.(attachmentId);

  // Part 0 is the original, part n is slide n.
  const blobs = [prepared.file, ...prepared.slides.map((s) => s.blob)];
  let targets: AttachmentUploadTargets = begin;
  // Wall-clock on purpose: it keeps running while the machine sleeps, as the
  // policies' expiry does.
  let expiresAt = Date.now() + begin.ttlSeconds * 1000;
  const targetFor = (i: number): PostTarget => (i === 0 ? targets.original : targets.pages[i - 1]);
  const renew = async () => {
    const res = await renewAttachmentUploadAction(courseId, attachmentId);
    if (!res.ok) throw new RenewRefusedError(res.error);
    targets = res;
    expiresAt = Date.now() + res.ttlSeconds * 1000;
  };

  const total = blobs.reduce((sum, b) => sum + b.size, 0) || 1;
  let sent = 0;

  try {
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const post = () =>
        postToBucket(targetFor(i), blob, {
          signal,
          onProgress: (loaded) => input.onProgress?.(Math.min(1, (sent + loaded) / total)),
        });
      if (Date.now() > expiresAt - RENEW_MARGIN_MS) await renew();
      try {
        await post();
      } catch (err) {
        // 403 is what an expired policy gets; renew once and resend this part.
        // Anything else (or a second 403) is a real refusal.
        if (!(err instanceof BucketUploadError && err.code === "rejected" && err.status === 403)) {
          throw err;
        }
        await renew();
        await post();
      }
      sent += blob.size;
    }
  } catch (err) {
    discard();
    if (signal.aborted || (err instanceof BucketUploadError && err.code === "aborted")) {
      return { ok: false, aborted: true };
    }
    if (err instanceof RenewRefusedError) return { ok: false, aborted: false, error: err.localized };
    const code = err instanceof BucketUploadError && err.code === "rejected" ? "rejected" : "network";
    return { ok: false, aborted: false, clientCode: code };
  }

  input.onFinalizing?.();
  let fin: Awaited<ReturnType<typeof finalizeAttachmentUploadAction>>;
  try {
    fin = await finalizeAttachmentUploadAction(courseId, attachmentId);
  } catch {
    discard();
    return { ok: false, aborted: false, clientCode: "network" };
  }
  if (!fin.ok) {
    discard();
    return { ok: false, aborted: false, error: fin.error };
  }
  return { ok: true, attachment: fin.attachment };
}

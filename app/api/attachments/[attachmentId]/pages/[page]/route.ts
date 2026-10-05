import { pageKey } from "@/lib/attachments/keys";
import { THUMB_WIDTH } from "@/lib/attachments/limits";
import { authorizeAttachment, isCrossSite, refuse } from "@/lib/attachments/serve";
import { UndeclaredSlideError, renderSlide, watermarkText } from "@/lib/attachments/watermark";
import { getAttachmentsBucket, getObjectBytes } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One slide of a lesson attachment. `?size=thumb` serves a THUMB_WIDTH-wide
 * version (Studio thumbnails, the viewer's strip). Everything re-encoded here
 * (watermarked or resized) is WebP; a downloadable deck's full-size slide is
 * passed through in its stored format (WebP, or the JPEG fallback).
 *
 * View-only attachments (allowDownload off) get the viewer's watermark burned
 * in on every request, thumbnails included — the bytes that leave the server
 * always identify who fetched them. The response is never cacheable and
 * never a redirect to storage: the student client never sees a key or a
 * storage URL.
 *
 * Because that work is real, each account has a request budget here (429 +
 * Retry-After past it), and the stored bytes must match the row's declared
 * slide format and page size before anything is decoded or passed through.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ attachmentId: string; page: string }> },
) {
  if (isCrossSite(req)) return refuse(403, "Forbidden");

  const { attachmentId, page } = await params;
  const gate = await authorizeAttachment(attachmentId, { budget: "pages" });
  if (gate instanceof Response) return gate;
  const { user, attachment } = gate;

  if (!/^\d{1,4}$/.test(page)) return refuse(404, "Not found");
  const n = Number(page);
  if (n < 1 || n > attachment.pageCount) return refuse(404, "Not found");

  const thumb = new URL(req.url).searchParams.get("size") === "thumb";
  const passthrough = attachment.allowDownload && !thumb;
  let body: Uint8Array;
  try {
    const stored = await getObjectBytes(
      pageKey(attachment.storagePrefix, n, attachment.slideMime),
      getAttachmentsBucket(),
    );
    if (!stored) return refuse(404, "Not found");
    const declared = attachment.pages[n - 1];
    if (!declared) throw new UndeclaredSlideError();
    body = await renderSlide(stored, {
      declared: { mime: attachment.slideMime, w: declared.w, h: declared.h },
      watermark: attachment.allowDownload ? null : watermarkText(user),
      width: thumb ? THUMB_WIDTH : undefined,
    });
  } catch (err) {
    // Storage unreachable, or bytes that are not the declared slide (replaced
    // after finalize through a still-valid upload policy): never fall back to
    // serving anything unchecked or unwatermarked.
    if (err instanceof UndeclaredSlideError) {
      console.error("[attachments] stored slide does not match its declaration", attachment.id, n);
    } else {
      console.error("[attachments] slide render failed", attachment.id, n, err);
    }
    return refuse(503, "Unavailable");
  }

  return new Response(Buffer.from(body), {
    status: 200,
    headers: {
      "Content-Type": passthrough ? attachment.slideMime : "image/webp",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Robots-Tag": "noindex",
    },
  });
}

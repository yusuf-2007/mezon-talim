import { originalKey } from "@/lib/attachments/keys";
import { isAcceptedMime, withExtensionFor } from "@/lib/attachments/limits";
import { authorizeAttachment, refuse } from "@/lib/attachments/serve";
import { getAttachmentsBucket, getSignedDownloadUrl } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How long the storage link stays valid — just enough to start the download. */
const DOWNLOAD_TTL_SECONDS = 60;

/**
 * Download the ORIGINAL file of an attachment — only when the teacher turned
 * "allow download" on. Same access rule as the slides; then a 302 to a
 * 60-second presigned GET that forces `Content-Disposition: attachment` with
 * the original file name — its extension forced to match the checked type
 * (begin already stores it that way; this also covers any older row). View-only
 * attachments answer 403 here, always.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await params;
  const gate = await authorizeAttachment(attachmentId);
  if (gate instanceof Response) return gate;
  const { attachment } = gate;

  if (!attachment.allowDownload) return refuse(403, "Forbidden");

  let url: string;
  try {
    url = await getSignedDownloadUrl(originalKey(attachment.storagePrefix), {
      bucket: getAttachmentsBucket(),
      filename: isAcceptedMime(attachment.mimeType)
        ? withExtensionFor(attachment.fileName, attachment.mimeType)
        : attachment.fileName,
      contentType: attachment.mimeType,
      ttlSeconds: DOWNLOAD_TTL_SECONDS,
    });
  } catch (err) {
    console.error("[attachments] download presign failed", attachment.id, err);
    return refuse(503, "Unavailable");
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}

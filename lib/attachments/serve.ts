import "server-only";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import {
  lessonAttachmentsRepository,
  type LessonAttachmentRow,
} from "@/lib/db/repositories/lesson-attachments";
import { resolveLessonAccess } from "@/lib/learning/lesson-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { isAttachmentStorageConfigured } from "@/lib/storage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Headers on every refusal: never cache, never sniff, never index. */
const ERROR_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

export function refuse(
  status: 401 | 403 | 404 | 429 | 503,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(message, { status, headers: { ...ERROR_HEADERS, ...headers } });
}

const MINUTE = 60_000;

/**
 * Per-account request budgets, one fixed window each.
 *
 * `pages`: every view-only slide is watermarked on request — several Postgres
 * round-trips for the access check plus ~150 ms of CPU at full size — so a
 * script looping over a deck must not get it unthrottled. Sized well above a
 * real viewer: a page turn costs the slide plus a prefetch (aborted fetches
 * still reach the server), and a strip of up to 150 thumbnails reloads as it
 * scrolls. Teachers and admins get more: they page through every deck they
 * check, and the Studio shows a thumbnail per attachment.
 */
const BUDGETS = {
  pages: { viewer: 2000, author: 6000, windowMs: 10 * MINUTE },
} as const;

export type AttachmentBudget = keyof typeof BUDGETS;

export type AuthorizedAttachment = {
  user: SessionUser;
  attachment: LessonAttachmentRow;
  isInstructor: boolean;
};

/**
 * The shared gate for /api/attachments/*:
 *  - 401 without a session;
 *  - 404 for a malformed id, an unknown or not-ready attachment, a deleted
 *    lesson/course, or when storage is not configured;
 *  - 429 once the account has spent `budget` (when one is given) — checked
 *    before any attachment or curriculum lookup, so a refused request costs
 *    one counter upsert and nothing else;
 *  - 403 when the viewer may not open the lesson (same rule as the lesson
 *    page: accessible in their curriculum, or the course's instructor).
 */
export async function authorizeAttachment(
  attachmentId: string,
  opts: { budget?: AttachmentBudget } = {},
): Promise<AuthorizedAttachment | Response> {
  const user = await getCurrentUser();
  if (!user) return refuse(401, "Unauthorized");
  if (!UUID_RE.test(attachmentId) || !isAttachmentStorageConfigured()) {
    return refuse(404, "Not found");
  }

  if (opts.budget) {
    const budget = BUDGETS[opts.budget];
    const author = user.role === "teacher" || user.role === "super_admin";
    const { ok, retryAfterMs } = await checkRateLimit(
      `attachments:${opts.budget}:${user.id}`,
      author ? budget.author : budget.viewer,
      budget.windowMs,
    );
    if (!ok) {
      return refuse(429, "Too many requests", {
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
      });
    }
  }

  const attachment = await lessonAttachmentsRepository.findById(attachmentId);
  if (!attachment || attachment.status !== "ready") return refuse(404, "Not found");

  const access = await resolveLessonAccess(user, attachment.lessonId);
  if (!access) return refuse(404, "Not found");
  if (!access.canView) return refuse(403, "Forbidden");

  return { user, attachment, isInstructor: access.isInstructor };
}

/**
 * Hotlink guard. Browsers send Sec-Fetch-Site on every request; anything other
 * than our own origin (or a direct, user-initiated load) is refused, so another
 * site cannot embed slides even for a signed-in visitor. Old clients that omit
 * the header still pass the session + access checks.
 */
export function isCrossSite(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  return site !== null && site !== "same-origin" && site !== "none";
}

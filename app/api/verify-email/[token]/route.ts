import { NextResponse, type NextRequest } from "next/server";
import { confirmEmailVerification } from "@/lib/auth/email-verify";
import { getCurrentUser, refreshSession } from "@/lib/auth";
import { routing } from "@/lib/i18n/routing";

/**
 * The target of the confirmation link.
 *
 * A route handler rather than a page, for one reason: confirming writes
 * `users.email`, and the session cookie is a JWT snapshot that would go on
 * claiming the account has no address until the student next signed in. Only
 * actions and route handlers may set cookies, so the write and the session
 * refresh have to happen here; the page that follows just reports the outcome.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const requested = request.nextUrl.searchParams.get("locale");
  const locale = routing.locales.includes(requested as never)
    ? (requested as string)
    : routing.defaultLocale;

  const status = await confirmEmailVerification(token);

  if (status === "ok") {
    // Best-effort: the link is often opened in a browser with no session at
    // all (another device, or a mail scanner following it). Nothing here should
    // turn a successful confirmation into an error page.
    try {
      if (await getCurrentUser()) await refreshSession();
    } catch (err) {
      console.error("session refresh after email confirmation failed:", err);
    }
  }

  const to = new URL(`/${locale}/verify-email`, request.nextUrl.origin);
  to.searchParams.set("status", status);
  return NextResponse.redirect(to);
}

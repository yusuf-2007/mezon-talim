import createMiddleware from "next-intl/middleware";
import { routing } from "./lib/i18n/routing";

/**
 * Next.js proxy (the renamed "middleware" convention in Next 16). Handles
 * locale negotiation + redirect (e.g. "/" → "/uz"). Role-based route guards
 * (requireRole) will be layered on top of this in Phase 2.
 */
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, files with an extension, and the static
  // landing-page previews under /preview (served from public/, no i18n).
  matcher: "/((?!api|preview|_next|_vercel|.*\\..*).*)",
};

import { requireUser } from "@/lib/auth";

/**
 * Student area — any authenticated user. Role-specific areas are studio/admin.
 *
 * Deliberately chrome-less: the dashboard carries its own navy rail, and the
 * player and exam carry their own focused shells. Everything else that wants
 * the standard header and footer wraps itself in SiteShell (see
 * ./notifications), because applying it here would put a second header, bell
 * and log-out above the rail's.
 */
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return children;
}

import { requireUser } from "@/lib/auth";
import { SiteShell } from "@/components/site-shell";

/** Student area — any authenticated user. Role-specific areas are studio/admin. */
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <SiteShell>{children}</SiteShell>;
}

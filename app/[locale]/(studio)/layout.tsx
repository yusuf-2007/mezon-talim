import { requireRole } from "@/lib/auth";
import { SiteShell } from "@/components/site-shell";

/** Teacher authoring area — teachers and super admins only. */
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("teacher", "super_admin");
  return <SiteShell>{children}</SiteShell>;
}

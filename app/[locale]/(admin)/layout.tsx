import { requireRole } from "@/lib/auth";

/** Admin + finance area — super admins and accountants only. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("super_admin", "accountant");
  return <>{children}</>;
}

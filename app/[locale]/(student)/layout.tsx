import { requireUser } from "@/lib/auth";

/** Student area — any authenticated user. Role-specific areas are studio/admin. */
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <>{children}</>;
}

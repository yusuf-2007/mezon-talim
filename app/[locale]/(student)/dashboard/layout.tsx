import { requireUser } from "@/lib/auth";
import { messagesRepository } from "@/lib/db/repositories/messages";
import { userAvatarsRepository } from "@/lib/db/repositories/user-avatars";
import { DashboardRail } from "@/components/student/dashboard-rail";
import { DashboardTabBar } from "@/components/student/dashboard-tabbar";

/**
 * Student dashboard shell.
 *
 * A persistent navy rail from `lg` up, a bottom tab bar below it — the player
 * and exams keep their own focused shells, so this wraps /dashboard/* only.
 * The rail is `h-screen sticky` and the main column scrolls independently, so
 * navigation stays put through a long certificate or glossary list.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [hasAvatar, unreadMessages] = await Promise.all([
    userAvatarsRepository.exists(user.id),
    messagesRepository.awaitingReplyCount(user.id),
  ]);
  const name = user.fullName || user.email || user.phone || "—";

  const railProps = {
    name,
    email: user.email,
    hasAvatar,
    userId: user.id,
    unreadMessages,
  };

  return (
    <div className="grid min-h-screen bg-lp-wash-alt font-lp-body lg:grid-cols-[236px_1fr]">
      <DashboardRail {...railProps} />
      <main className="min-w-0 px-5 pb-24 pt-6 sm:px-8 lg:px-10 lg:pb-16 lg:pt-7">
        <div className="mx-auto max-w-[1120px]">{children}</div>
      </main>
      <DashboardTabBar {...railProps} />
    </div>
  );
}

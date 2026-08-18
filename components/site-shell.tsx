import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { OccupationPoll } from "@/components/audience/occupation-poll";

/**
 * The standard app chrome: auth-aware top bar, content, footer, entry poll.
 *
 * Lives in a component rather than the locale layout because the landing page
 * ships its own marketing header/footer (see components/landing/) and must not
 * render this one. Every route group that wants the standard chrome wraps its
 * children here.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <OccupationPoll />
    </>
  );
}

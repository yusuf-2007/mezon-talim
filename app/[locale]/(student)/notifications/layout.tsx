import { SiteShell } from "@/components/site-shell";

/** Standard app chrome — the student layout no longer supplies it. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}

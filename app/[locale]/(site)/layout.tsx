import { SiteShell } from "@/components/site-shell";

/** Public content pages (catalog, course, about, faq, verify) under the standard chrome. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}

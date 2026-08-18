import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/i18n/routing";
import { LandingHeader } from "@/components/landing/landing-header";
import { Hero } from "@/components/landing/hero";
import { StatusChain } from "@/components/landing/status-chain";
import { WhyNow } from "@/components/landing/why-now";
import { ProofQuote } from "@/components/landing/proof-quote";
import { CourseSection } from "@/components/landing/course-section";
import { LanguageBridge } from "@/components/landing/language-bridge";
import { Instructors } from "@/components/landing/instructors";
import { Testimonials } from "@/components/landing/testimonials";
import { Certificates } from "@/components/landing/certificates";
import { BimCourse } from "@/components/landing/bim-course";
import { Organisations } from "@/components/landing/organisations";
import { Faq } from "@/components/landing/faq";
import { ApplySection } from "@/components/landing/apply-section";
import { LandingFooter } from "@/components/landing/landing-footer";

/**
 * The CPSS landing page — an implementation of the "Landing Page CPSS" Claude
 * Design project (source kept at docs/design/landing-cpss.dc.html).
 *
 * It ships its own header and footer rather than the app chrome, so it is the
 * one route outside the (site) group. All copy lives in the `Landing` namespace
 * of messages/*.json; the facts Mezon has not supplied yet render as visible
 * [BRACKETED] placeholders.
 *
 * Deliberately session-free: this is the highest-traffic page on the site and
 * nothing above the fold depends on who is looking. The header's "Kirish" link
 * points at /login, whose layout already redirects a signed-in user to their
 * own landing path, so a session lookup here would buy nothing.
 */
export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Landing.nav");

  return (
    <div className="lp flex min-h-full flex-col">
      {/* Scroll-reveal starts hidden; without JS it would never appear. */}
      <noscript>
        <style>{`.lp-rv{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      {/* The beam: reading position, rendered as the balance's own indicator. */}
      <div className="lp-beam" aria-hidden />

      <LandingHeader loginLabel={t("login")} />

      <main className="flex-1">
        <Hero />
        <StatusChain />
        <WhyNow />
        <ProofQuote />
        <CourseSection />
        <LanguageBridge />
        <Instructors />
        <Testimonials />
        <Certificates />
        <BimCourse />
        <Organisations />
        <Faq />
        <ApplySection />
      </main>

      <LandingFooter />
    </div>
  );
}

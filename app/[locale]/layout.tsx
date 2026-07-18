import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inter, Source_Serif_4 } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import { routing, type Locale } from "@/lib/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { OccupationPoll } from "@/components/audience/occupation-poll";
import "../globals.css";

// Inter for body/UI, Source Serif 4 for headings. Both carry Latin-extended
// (Uzbek: oʻ gʻ) and Cyrillic (Russian) glyphs — see design-system §2.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Meta" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering for this locale segment.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${sourceSerif.variable} h-full antialiased`}
      // Some browser extensions inject attributes (e.g. webcrx="") on <html>
      // before React hydrates; ignore those harmless mismatches.
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <NextIntlClientProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <OccupationPoll />
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronDown } from "lucide-react";
import type { Locale } from "@/lib/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Faq" });
  return { title: t("heroTitle") };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Faq");

  // Q&A list lives in the messages file; rendered as a native <details> accordion
  // so no client JS is needed and it stays accessible/keyboard-friendly.
  const items = t.raw("items") as { q: string; a: string }[];

  return (
    <div>
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h1 className="font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-navy-100">{t("heroSubtitle")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          {items.map((item, i) => (
            <details key={i} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-medium text-navy-800 transition-colors hover:bg-navy-50/40 [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-6 pb-5 text-sm leading-relaxed text-slate-500">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">{t("contactNote")}</p>
      </section>
    </div>
  );
}

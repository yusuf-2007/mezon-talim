import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "About" });
  return { title: t("heroTitle") };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("About");

  const steps = [
    { n: "1", title: t("step1Title"), body: t("step1Body") },
    { n: "2", title: t("step2Title"), body: t("step2Body") },
    { n: "3", title: t("step3Title"), body: t("step3Body") },
    { n: "4", title: t("step4Title"), body: t("step4Body") },
  ];

  return (
    <div>
      {/* Navy hero band (design-system §1) */}
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <p className="mb-4 inline-flex items-center rounded-full bg-navy-800 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gold-100">
            {t("heroBadge")}
          </p>
          <h1 className="max-w-3xl font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-navy-100">{t("heroSubtitle")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        {/* Mission + AAOIFI + affiliation */}
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <h2 className="font-heading text-xl font-semibold text-navy-800">
              {t("missionTitle")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              {t("missionBody")}
            </p>
          </div>
          <div>
            <h2 className="font-heading text-xl font-semibold text-navy-800">
              {t("aaoifiTitle")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              {t("aaoifiBody")}
            </p>
          </div>
          <div>
            <h2 className="font-heading text-xl font-semibold text-navy-800">
              {t("affiliationTitle")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              {t("affiliationBody")}
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-16">
          <h2 className="font-heading text-2xl font-semibold text-navy-800">
            {t("howTitle")}
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li
                key={s.n}
                className="rounded-xl border border-line bg-surface p-6 shadow-sm"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-navy-900 font-heading text-sm font-semibold text-gold-100">
                  {s.n}
                </span>
                <h3 className="mt-4 font-heading text-base font-semibold text-navy-800">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl bg-navy-900 px-6 py-12 text-center text-white sm:px-12">
          <h2 className="font-heading text-2xl font-semibold">{t("ctaTitle")}</h2>
          <div className="mt-6">
            <Button render={<Link href="/catalog" />} size="lg">
              {t("ctaButton")}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Landing");

  const valueProps = [
    { title: t("valueVideoTitle"), body: t("valueVideoBody") },
    { title: t("valueAssessTitle"), body: t("valueAssessBody") },
    { title: t("valueCertTitle"), body: t("valueCertBody") },
  ];

  return (
    <div>
      {/* Navy hero band with gold primary CTA (design-system §1 "the key move") */}
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="mb-4 inline-flex items-center rounded-full bg-navy-800 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gold-100">
            {t("affiliationNote")}
          </p>
          <h1 className="max-w-3xl font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-navy-100">
            {t("heroSubtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button render={<Link href="/catalog" />} size="lg">
              {t("browseCourses")}
            </Button>
            <Button
              render={<Link href="/about" />}
              size="lg"
              variant="outline"
              className="border-navy-100/40 bg-transparent text-white hover:bg-navy-800 hover:text-white"
            >
              {t("aboutAaoifi")}
            </Button>
          </div>
        </div>
      </section>

      {/* Light content below */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {valueProps.map((vp) => (
            <div
              key={vp.title}
              className="rounded-xl border border-line bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <h2 className="font-heading text-xl font-semibold text-navy-800">
                {vp.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {vp.body}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-slate-500">
          {t("comingSoon")}
        </p>
      </section>
    </div>
  );
}

import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { pickLocale } from "@/lib/i18n/localized";
import { CertCard } from "@/components/student/cert-card";
import type { Locale } from "@/lib/i18n/routing";

export default async function CertificatesPage() {
  const user = await requireUser();
  const t = await getTranslations("Student");
  const locale = (await getLocale()) as Locale;

  const all = await certificatesRepository.listForUserAll(user.id);
  const certs = all.filter((c) => !c.revokedAt);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy-800">
          {t("certsTitle")}
        </h1>
        <p className="mt-1 text-slate-500">{t("certsSub")}</p>
      </div>

      {certs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="text-4xl">🎓</p>
          <p className="mt-3 text-slate-500">{t("noCerts")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certs.map((c) => (
            <CertCard
              key={c.id}
              code={c.verificationCode}
              title={pickLocale(c.courseTitle, locale)}
              issued={new Date(c.issuedAt).toLocaleDateString(
                locale === "ru" ? "ru-RU" : "uz-UZ",
              )}
              labels={{ download: t("download"), verify: t("verify") }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

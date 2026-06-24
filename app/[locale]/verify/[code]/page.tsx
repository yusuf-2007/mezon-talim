import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { verifyByCode } from "@/lib/certificates/service";
import { pickLocale } from "@/lib/i18n/localized";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

function formatDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Certificate");
  const loc = await getLocale();

  const result = await verifyByCode(code);

  return (
    <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-center font-heading text-2xl font-semibold text-navy-800">
        {t("verifyTitle")}
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        {t("verifySubtitle")}
      </p>

      {!result ? (
        <div className="mt-8 rounded-xl border border-danger/40 bg-danger/5 p-8 text-center">
          <p className="text-4xl">❌</p>
          <p className="mt-3 font-medium text-danger">{t("notFound")}</p>
          <p className="mt-1 text-sm text-slate-500">
            {t("notFoundHint", { code })}
          </p>
        </div>
      ) : (
        <div
          className={cn(
            "mt-8 rounded-xl border p-8",
            result.valid
              ? "border-success/40 bg-success/5"
              : "border-danger/40 bg-danger/5",
          )}
        >
          <div className="text-center">
            <p className="text-4xl">{result.valid ? "✅" : "⛔"}</p>
            <p
              className={cn(
                "mt-3 font-medium",
                result.valid ? "text-success" : "text-danger",
              )}
            >
              {result.valid ? t("valid") : t("revoked")}
            </p>
          </div>

          <dl className="mt-6 divide-y divide-line border-t border-line text-sm">
            <Row label={t("student")} value={result.studentName} />
            <Row label={t("course")} value={pickLocale(result.courseTitle, loc)} />
            <Row label={t("issued")} value={formatDate(result.issuedAt)} />
            <Row label={t("code")} value={result.verificationCode} mono />
          </dl>

          {result.valid && (
            <div className="mt-6 text-center">
              <Button
                render={
                  <a
                    href={`/api/certificates/${result.verificationCode}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                {t("download")}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn("text-right font-medium text-ink", mono && "tabular-nums")}>
        {value}
      </dd>
    </div>
  );
}

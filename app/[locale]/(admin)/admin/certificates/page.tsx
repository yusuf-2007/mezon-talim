import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { revokeCertificateAction, reissueCertificateAction } from "@/lib/admin/actions";
import { pickLocale } from "@/lib/i18n/localized";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/admin/stat-card";
import { ConfirmSubmit } from "@/components/studio/confirm-submit";
import type { Locale } from "@/lib/i18n/routing";

export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const { q, status } = await searchParams;

  const [counts, certs] = await Promise.all([
    certificatesRepository.statusCounts(),
    certificatesRepository.listAll({
      search: q,
      status: status === "active" || status === "revoked" ? status : undefined,
    }),
  ]);

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString(locale === "ru" ? "ru-RU" : "uz-UZ");

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-navy-800">
        {t("certificatesTitle")}
      </h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("statCertsTotal")} value={String(counts.total)} />
        <StatCard label={t("statCertsActive")} value={String(counts.active)} />
        <StatCard label={t("statCertsRevoked")} value={String(counts.revoked)} />
      </div>

      {/* Search + status filter (GET form) */}
      <form className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("certsSearch")}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
        >
          <option value="">{t("certFilterAll")}</option>
          <option value="active">{t("certFilterActive")}</option>
          <option value="revoked">{t("certFilterRevoked")}</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          {t("filter")}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">{t("colCertNumber")}</th>
              <th className="px-4 py-3 font-medium">{t("colStudent")}</th>
              <th className="px-4 py-3 font-medium">{t("colCourse")}</th>
              <th className="px-4 py-3 font-medium">{t("colIssued")}</th>
              <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
              <th className="px-4 py-3 font-medium">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {certs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {t("noCerts")}
                </td>
              </tr>
            ) : (
              certs.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono tabular-nums text-navy-700">
                    {c.verificationCode}
                  </td>
                  <td className="px-4 py-3 text-ink">{c.userName || c.userEmail}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {pickLocale(c.courseTitle, locale)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {formatDate(c.issuedAt)}
                  </td>
                  <td className="px-4 py-3">
                    {c.revokedAt ? (
                      <Badge variant="destructive">{t("certRevoked")}</Badge>
                    ) : (
                      <Badge className="bg-success/10 text-success">
                        {t("certActive")}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/${locale}/verify/${c.verificationCode}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-navy-600 hover:underline"
                      >
                        {t("view")}
                      </a>
                      <a
                        href={`/api/certificates/${c.verificationCode}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-navy-600 hover:underline"
                      >
                        {t("downloadCert")}
                      </a>
                      {c.revokedAt ? (
                        <form action={reissueCertificateAction.bind(null, c.id)}>
                          <ConfirmSubmit label={t("reissueCert")} />
                        </form>
                      ) : (
                        <form action={revokeCertificateAction.bind(null, c.id)}>
                          <ConfirmSubmit label={t("revokeCert")} />
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

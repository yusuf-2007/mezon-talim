import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { auditRepository } from "@/lib/db/repositories/audit";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/i18n/routing";

export default async function AdminAuditPage() {
  await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;

  const entries = await auditRepository.recentWithActor(100);
  const dateLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-navy-800">
        {t("auditTitle")}
      </h1>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">{t("colWhen")}</th>
              <th className="px-4 py-3 font-medium">{t("colActor")}</th>
              <th className="px-4 py-3 font-medium">{t("colAction")}</th>
              <th className="px-4 py-3 font-medium">{t("colEntity")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  {t("noAudit")}
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 tabular-nums text-slate-500">
                    {new Date(entry.createdAt).toLocaleString(dateLocale)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {entry.actorName || entry.actorEmail || "system"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="bg-navy-100 text-navy-800 font-mono text-xs">
                      {entry.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {entry.entityType
                      ? `${entry.entityType}: ${entry.entityId?.slice(0, 8) ?? ""}`
                      : "—"}
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

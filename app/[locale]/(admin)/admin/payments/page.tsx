import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { analyticsRepository } from "@/lib/db/repositories/analytics";
import { formatTiyin } from "@/lib/payments";
import { pickLocale } from "@/lib/i18n/localized";
import { StatCard } from "@/components/admin/stat-card";
import { RevenueBars } from "@/components/admin/revenue-bars";
import type { Locale } from "@/lib/i18n/routing";

function formatDate(d: Date, locale: Locale): string {
  return new Date(d).toLocaleDateString(locale === "ru" ? "ru-RU" : "uz-UZ");
}

export default async function AdminFinancePage() {
  await requireRole("super_admin", "accountant");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;

  const [overview, byProvider, byDay, sales] = await Promise.all([
    analyticsRepository.overview(),
    analyticsRepository.revenueByProvider(),
    analyticsRepository.revenueByDay(30),
    analyticsRepository.recentSales(25),
  ]);

  const click = byProvider.find((p) => p.provider === "click");
  const payme = byProvider.find((p) => p.provider === "payme");

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-semibold text-navy-800">
        {t("financeTitle")}
      </h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("kpiRevenue")}
          value={formatTiyin(overview.totalRevenueTiyin, locale)}
          sub={t("kpiRevenueSub", { count: overview.paidCount })}
        />
        <StatCard
          label={t("providerClick")}
          value={formatTiyin(click?.totalTiyin ?? 0, locale)}
          sub={t("txnCount", { count: click?.count ?? 0 })}
        />
        <StatCard
          label={t("providerPayme")}
          value={formatTiyin(payme?.totalTiyin ?? 0, locale)}
          sub={t("txnCount", { count: payme?.count ?? 0 })}
        />
      </div>

      <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-navy-800">
          {t("revenue30d")}
        </h2>
        <div className="mt-4">
          <RevenueBars data={byDay} locale={locale} emptyLabel={t("noSales")} />
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">{t("colDate")}</th>
              <th className="px-4 py-3 font-medium">{t("colBuyer")}</th>
              <th className="px-4 py-3 font-medium">{t("colCourse")}</th>
              <th className="px-4 py-3 font-medium">{t("colProvider")}</th>
              <th className="px-4 py-3 font-medium tabular-nums">{t("colAmount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sales.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {t("noSales")}
                </td>
              </tr>
            ) : (
              sales.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-slate-500 tabular-nums">
                    {formatDate(s.createdAt, locale)}
                  </td>
                  <td className="px-4 py-3 text-ink">{s.userName || s.userEmail || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {pickLocale(s.courseTitle, locale)}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-500">{s.provider}</td>
                  <td className="px-4 py-3 font-medium tabular-nums text-navy-700">
                    {formatTiyin(s.amountTiyin, locale)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

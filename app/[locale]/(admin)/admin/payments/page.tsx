import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { paymentsRepository } from "@/lib/db/repositories/payments";
import { formatTiyin } from "@/lib/payments";
import { pickLocale } from "@/lib/i18n/localized";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/routing";

const STATUSES = ["pending", "paid", "failed", "refunded"] as const;
type PaymentStatus = (typeof STATUSES)[number];

/** Design-token classes per payment status: paid→success, pending→gold/navy, failed/refunded→danger. */
const STATUS_BADGE: Record<PaymentStatus, string> = {
  paid: "bg-success/10 text-success",
  pending: "bg-gold-100 text-navy-800",
  failed: "bg-danger/10 text-danger",
  refunded: "bg-danger/10 text-danger",
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireRole("super_admin", "accountant");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const { q, status } = await searchParams;

  const filterStatus = (STATUSES as readonly string[]).includes(status ?? "")
    ? (status as PaymentStatus)
    : undefined;

  const [counts, payments] = await Promise.all([
    paymentsRepository.statusCounts(),
    paymentsRepository.listAll({ search: q, status: filterStatus }),
  ]);

  const countsByStatus = new Map<string, { count: number; totalTiyin: number }>(
    counts.map((c) => [c.status, { count: c.count, totalTiyin: c.totalTiyin }]),
  );
  const paid = countsByStatus.get("paid") ?? { count: 0, totalTiyin: 0 };
  const pending = countsByStatus.get("pending") ?? { count: 0, totalTiyin: 0 };
  const failed = countsByStatus.get("failed") ?? { count: 0, totalTiyin: 0 };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-navy-800">
        {t("paymentsTitle")}
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("kpiRevenue")}
          value={formatTiyin(paid.totalTiyin, locale)}
          sub={t("statCompleted")}
        />
        <StatCard label={t("statCompleted")} value={String(paid.count)} />
        <StatCard label={t("statPending")} value={String(pending.count)} />
        <StatCard label={t("statFailed")} value={String(failed.count)} />
      </div>

      {/* Search + status filter (GET form) */}
      <form className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchPayments")}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
        >
          <option value="">{t("payAll")}</option>
          <option value="paid">{t("pay_paid")}</option>
          <option value="pending">{t("pay_pending")}</option>
          <option value="failed">{t("pay_failed")}</option>
          <option value="refunded">{t("pay_refunded")}</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          {t("filter")}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">{t("colDate")}</th>
              <th className="px-4 py-3 font-medium">{t("colRef")}</th>
              <th className="px-4 py-3 font-medium">{t("colBuyer")}</th>
              <th className="px-4 py-3 font-medium">{t("colCourse")}</th>
              <th className="px-4 py-3 font-medium">{t("colProvider")}</th>
              <th className="px-4 py-3 font-medium tabular-nums">{t("colAmount")}</th>
              <th className="px-4 py-3 font-medium">{t("colPayStatus")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  {t("noPayments")}
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 tabular-nums text-slate-500">
                    {new Date(p.createdAt).toLocaleDateString(
                      locale === "ru" ? "ru-RU" : "uz-UZ",
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-xs text-slate-600">
                    {p.providerTxnId || p.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {p.userName || p.userEmail}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {pickLocale(p.courseTitle, locale)}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-500">
                    {p.provider}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums text-navy-700">
                    {formatTiyin(p.amountTiyin, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_BADGE[p.status]}>
                      {t(`pay_${p.status}`)}
                    </Badge>
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

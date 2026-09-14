import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { notificationsRepository } from "@/lib/db/repositories/notifications";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Delivery log.
 *
 * Exists because "sent" was the end of the story: the provider's API accepting
 * a message told us nothing about whether it arrived, and a student who never
 * received a login code had no way to report it beyond "it doesn't work". The
 * Delivered and Rejected columns are the part that is worth looking at — a
 * cluster of rejections is a problem with the gateway, not with the student.
 */

const TONES: Record<string, string> = {
  delivered: "bg-success/10 text-success",
  sent: "bg-navy-100 text-navy-800",
  queued: "bg-slate-100 text-slate-500",
  rejected: "bg-danger/10 text-danger",
  failed: "bg-danger/10 text-danger",
};

export default async function AdminNotificationsPage() {
  await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const dateLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ";

  const [rows, counts] = await Promise.all([
    notificationsRepository.listRecentWithRecipient(100),
    notificationsRepository.statusCounts(500),
  ]);

  const byStatus = new Map(counts.map((c) => [c.status, c.count]));
  const tiles = (["delivered", "sent", "rejected", "failed"] as const).map((s) => ({
    status: s,
    label: t(`notifStatus_${s}`),
    count: byStatus.get(s) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-navy-800">
          {t("notifTitle")}
        </h1>
        <p className="mt-1 max-w-prose text-sm text-slate-500">{t("notifSubtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.status}
            className="rounded-xl border border-line bg-surface p-4 shadow-sm"
          >
            <p className="text-sm text-slate-500">{tile.label}</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-navy-800 tabular-nums">
              {tile.count}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-3 font-medium">{t("colWhen")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("notifColChannel")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("notifColType")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("notifColTo")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("notifColStatus")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {t("notifEmpty")}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const to = (row.payload as { to?: string } | null)?.to ?? "—";
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3 tabular-nums text-slate-500">
                      {new Date(row.createdAt).toLocaleString(dateLocale)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.channel}</td>
                    <td className="px-4 py-3 text-slate-600">{row.type}</td>
                    <td className="px-4 py-3">
                      <span className="text-ink">{to}</span>
                      {row.recipientName && (
                        <span className="ml-2 text-slate-500">{row.recipientName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          TONES[row.status] ?? TONES.queued
                        }`}
                      >
                        {t(`notifStatus_${row.status}`)}
                      </span>
                      {/* The provider's own word, when it disagrees with ours. */}
                      {row.providerStatus && (
                        <span className="ml-2 text-xs text-slate-400">
                          {row.providerStatus}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

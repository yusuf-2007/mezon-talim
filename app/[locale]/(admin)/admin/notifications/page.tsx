import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { notificationsRepository } from "@/lib/db/repositories/notifications";
import { APP_TIME_ZONE } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  Banner,
  Card,
  CardToolbar,
  FilterChips,
  KpiStrip,
  Pill,
  StatusDot,
  Table,
  type DotTone,
} from "@/components/admin/ui";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Delivery log.
 *
 * Exists because "sent" was the end of the story: the provider's API accepting
 * a message told us nothing about whether it arrived, and a student who never
 * got a login code had no way to report it beyond "it doesn't work".
 *
 * The rejected and failed columns are the ones worth looking at. A cluster of
 * rejections in a short window is a gateway problem, not a student problem, and
 * the banner says so rather than leaving someone to notice the pattern.
 */
const TONE: Record<string, DotTone> = {
  delivered: "green",
  sent: "navy",
  queued: "grey",
  rejected: "red",
  failed: "red",
};

/** Rejections this close together are one incident, not N student problems. */
const CLUSTER_WINDOW_HOURS = 2;
const CLUSTER_THRESHOLD = 5;

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; trouble?: string }>;
}) {
  const me = await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const { channel, trouble } = await searchParams;

  const onlyTrouble = trouble === "1";
  const activeChannel =
    channel === "sms" || channel === "email" ? channel : null;

  const [all, counts, rejectCluster] = await Promise.all([
    notificationsRepository.listRecentWithRecipient(200),
    notificationsRepository.statusCounts(500),
    // Counted in SQL rather than by filtering the page: a render must not read
    // the clock, and the window is a property of the question, not the list.
    notificationsRepository.countRejectedSince(CLUSTER_WINDOW_HOURS),
  ]);

  const rows = all.filter((r) => {
    if (activeChannel && r.channel !== activeChannel) return false;
    if (onlyTrouble && r.status !== "rejected" && r.status !== "failed")
      return false;
    return true;
  });

  const byStatus = new Map(counts.map((c) => [c.status, c.count]));
  const at = (s: (typeof counts)[number]["status"]) => byStatus.get(s) ?? 0;

  const href = (next: { channel?: string | null; trouble?: boolean }) => {
    const p = new URLSearchParams();
    const c = next.channel === undefined ? activeChannel : next.channel;
    const tr = next.trouble === undefined ? onlyTrouble : next.trouble;
    if (c) p.set("channel", c);
    if (tr) p.set("trouble", "1");
    const qs = p.toString();
    return `/admin/notifications${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navNotifications")}
        title={t("notifTitle")}
        userId={me.id}
        role={me.role}
      />

      <div className="mb-[18px]">
        <KpiStrip
          cells={[
            {
              label: t("notifStatus_delivered"),
              value: String(at("delivered")),
              tone: "green",
            },
            { label: t("notifStatus_sent"), value: String(at("sent")) },
            {
              label: t("notifStatus_rejected"),
              value: String(at("rejected")),
              tone: at("rejected") > 0 ? "red" : undefined,
            },
            {
              label: t("notifStatus_failed"),
              value: String(at("failed")),
              tone: at("failed") > 0 ? "red" : undefined,
            },
          ]}
        />
      </div>

      {rejectCluster >= CLUSTER_THRESHOLD && (
        <Banner tone="danger" className="mb-[18px]">
          {t("notifCluster", {
            count: rejectCluster,
            hours: CLUSTER_WINDOW_HOURS,
          })}
        </Banner>
      )}

      <Card>
        <CardToolbar>
          <FilterChips
            active={activeChannel}
            hrefFor={(v) => href({ channel: v })}
            options={[
              { value: null, label: t("filterAll") },
              { value: "sms", label: t("notifChannelSms") },
              { value: "email", label: t("notifChannelEmail") },
            ]}
          />
          <FilterChips
            active={onlyTrouble ? "1" : null}
            hrefFor={(v) => href({ trouble: v === "1" })}
            options={[{ value: "1", label: t("notifOnlyTrouble") }]}
          />
        </CardToolbar>

        <Table
          empty={t("notifEmpty")}
          head={[
            { label: t("colWhen") },
            { label: t("notifColTo") },
            { label: t("notifColChannel") },
            { label: t("notifColType"), hide: true },
            { label: t("notifColProvider"), hide: true },
            { label: t("notifColStatus") },
          ]}
          rows={rows.map((r) => {
            const to = (r.payload as { to?: string } | null)?.to ?? "—";
            return [
              <span
                key="w"
                className="whitespace-nowrap text-[.84rem] text-lp-slate tabular-nums"
              >
                {fmt(r.createdAt, locale)}
              </span>,
              <span key="t" className="block min-w-0">
                <span className="block truncate text-[.88rem] text-lp-ink">
                  {to}
                </span>
                {r.recipientName && (
                  <span className="block truncate text-[.8rem] text-lp-muted">
                    {r.recipientName}
                  </span>
                )}
              </span>,
              <Pill key="c" tone={r.channel === "sms" ? "gold" : "navy"}>
                {r.channel}
              </Pill>,
              <span key="ty" className="font-mono text-[.78rem] text-lp-muted">
                {r.type}
              </span>,
              /* The provider's own word, which is the thing support quotes. */
              <span key="p" className="font-mono text-[.78rem] text-lp-slate">
                {r.providerStatus || "—"}
              </span>,
              <StatusDot key="s" tone={TONE[r.status] ?? "grey"}>
                {t(`notifStatus_${r.status}`)}
              </StatusDot>,
            ];
          })}
        />
      </Card>
    </>
  );
}

function fmt(d: Date, locale: Locale) {
  return new Date(d).toLocaleString(
    locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ",
    {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: APP_TIME_ZONE,
    },
  );
}

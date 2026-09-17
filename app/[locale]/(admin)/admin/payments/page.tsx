import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { paymentsRepository } from "@/lib/db/repositories/payments";
import { formatTiyin } from "@/lib/payments";
import { pickLocale } from "@/lib/i18n/localized";
import { APP_TIME_ZONE } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  Card,
  CardToolbar,
  KpiStrip,
  FilterChips,
  SearchForm,
  StatusDot,
  Table,
  type DotTone,
} from "@/components/admin/ui";
import type { Locale } from "@/lib/i18n/routing";

const STATUSES = ["paid", "pending", "failed", "refunded"] as const;
type PaymentStatus = (typeof STATUSES)[number];

/** What each state means at a glance: settled, waiting, or gone wrong. */
const STATUS_TONE: Record<PaymentStatus, DotTone> = {
  paid: "green",
  pending: "amber",
  failed: "red",
  refunded: "red",
};

/**
 * The money ledger. Visible to accountants as well as super admins — it is the
 * one admin view finance actually needs.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const me = await requireRole("super_admin", "accountant");
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

  const by = new Map(counts.map((c) => [c.status, c]));
  const at = (s: PaymentStatus) => by.get(s) ?? { count: 0, totalTiyin: 0 };

  const href = (s: string | null) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (q) p.set("q", q);
    const qs = p.toString();
    return `/admin/payments${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navPayments")}
        title={t("paymentsTitle")}
        userId={me.id}
        role={me.role}
      />

      <div className="mb-[18px]">
        <KpiStrip
          cells={[
            {
              label: t("kpiRevenue"),
              value: formatTiyin(at("paid").totalTiyin, locale),
              sub: t("revenueMeta", { count: at("paid").count }),
            },
            { label: t("statCompleted"), value: String(at("paid").count) },
            {
              label: t("statPending"),
              value: String(at("pending").count),
              tone: at("pending").count > 0 ? "amber" : undefined,
            },
            {
              label: t("statFailed"),
              value: String(at("failed").count),
              tone: at("failed").count > 0 ? "red" : undefined,
            },
          ]}
        />
      </div>

      <Card>
        <CardToolbar>
          <FilterChips
            active={filterStatus ?? null}
            hrefFor={href}
            options={[
              { value: null, label: t("payAll") },
              ...STATUSES.map((s) => ({
                value: s,
                label: t(`pay_${s}`),
                count: at(s).count,
              })),
            ]}
          />
          <SearchForm
            action="/admin/payments"
            defaultValue={q}
            placeholder={t("searchPayments")}
            hidden={{ status: filterStatus }}
          />
        </CardToolbar>

        <Table
          empty={t("noPayments")}
          head={[
            { label: t("colDate") },
            { label: t("colBuyer") },
            { label: t("colCourse"), hide: true },
            { label: t("colRef"), hide: true },
            { label: t("colProvider") },
            { label: t("colAmount"), align: "right" },
            { label: t("colPayStatus") },
          ]}
          rows={payments.map((p) => [
            <span key="d" className="whitespace-nowrap text-[.84rem] text-lp-slate tabular-nums">
              {fmt(p.createdAt, locale)}
            </span>,
            <span key="b" className="block min-w-0 truncate font-semibold text-lp-ink">
              {p.userName || p.userEmail || "—"}
            </span>,
            <span key="c" className="block min-w-0 truncate text-[.86rem] text-lp-slate">
              {pickLocale(p.courseTitle, locale)}
            </span>,
            <span key="r" className="font-mono text-[.78rem] text-lp-muted tabular-nums">
              {p.providerTxnId || p.id.slice(0, 8)}
            </span>,
            <span key="pr" className="text-[.84rem] capitalize text-lp-slate">
              {p.provider}
            </span>,
            <span key="a" className="font-semibold text-lp-navy">
              {formatTiyin(p.amountTiyin, locale)}
            </span>,
            <StatusDot key="s" tone={STATUS_TONE[p.status as PaymentStatus] ?? "grey"}>
              {t(`pay_${p.status}`)}
            </StatusDot>,
          ])}
        />
      </Card>
    </>
  );
}

function fmt(d: Date, locale: Locale) {
  return new Date(d).toLocaleDateString(
    locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ",
    { day: "numeric", month: "short", timeZone: APP_TIME_ZONE },
  );
}

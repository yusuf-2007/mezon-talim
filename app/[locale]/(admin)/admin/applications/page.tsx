import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { applicationsRepository } from "@/lib/db/repositories/applications";
import { APP_TIME_ZONE } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ApplicationStatusSelect } from "@/components/admin/application-status-select";
import {
  Card,
  FilterChips,
  Pill,
  StatusDot,
  Table,
} from "@/components/admin/ui";
import type { Locale } from "@/lib/i18n/routing";

const STATUSES = ["new", "contacted", "enrolled", "declined"] as const;
const SOURCES = ["landing_cpss", "landing_bim", "landing_b2b", "other"] as const;
const PAGE_SIZE = 50;

/**
 * The follow-up queue for landing-page applications.
 *
 * The repository has existed since the landing page shipped; this is the first
 * screen that reads it, so until now a lead arrived in the database and nobody
 * could see it without SQL.
 *
 * Filters are URL params rather than client state, so a filtered view can be
 * sent to whoever is making the calls.
 */
export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; page?: string }>;
}) {
  const me = await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const sp = await searchParams;

  const status = pick(sp.status, STATUSES);
  const source = pick(sp.source, SOURCES);
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [{ rows, total }, byStatus, bySource] = await Promise.all([
    applicationsRepository.listFiltered({
      status,
      source,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    applicationsRepository.countByStatus(),
    applicationsRepository.countBySource(),
  ]);

  const statusCount = new Map(byStatus.map((r) => [r.status, Number(r.count)]));
  const sourceCount = new Map(bySource.map((r) => [r.source, Number(r.count)]));
  const grandTotal = byStatus.reduce((s, r) => s + Number(r.count), 0);

  const href = (next: { status?: string | null; source?: string | null }) => {
    const p = new URLSearchParams();
    const s = next.status === undefined ? status : next.status;
    const src = next.source === undefined ? source : next.source;
    if (s) p.set("status", s);
    if (src) p.set("source", src);
    const q = p.toString();
    return `/admin/applications${q ? `?${q}` : ""}`;
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navApplications")}
        title={t("appsPageTitle")}
        userId={me.id}
        role={me.role}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterChips
          active={status ?? null}
          hrefFor={(v) => href({ status: v })}
          options={[
            { value: null, label: t("filterAll"), count: grandTotal },
            ...STATUSES.map((s) => ({
              value: s,
              label: t(`appStatus_${s}`),
              count: statusCount.get(s) ?? 0,
            })),
          ]}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterChips
          active={source ?? null}
          hrefFor={(v) => href({ source: v })}
          options={[
            { value: null, label: t("appsAllSources") },
            ...SOURCES.filter((s) => (sourceCount.get(s) ?? 0) > 0).map((s) => ({
              value: s,
              label: t(`appSource_${s}`),
              count: sourceCount.get(s) ?? 0,
            })),
          ]}
        />
      </div>

      <Card>
        <Table
          empty={t("appsEmpty")}
          head={[
            { label: t("appsColName") },
            { label: t("appsColOrg"), hide: true },
            { label: t("appsColSource") },
            { label: t("appsColConsent"), hide: true },
            { label: t("appsColWhen") },
            { label: t("appsColStatus") },
          ]}
          rows={rows.map((a) => [
            <span key="n" className="block min-w-0">
              <span className="block truncate font-semibold text-lp-ink">{a.fullName}</span>
              <a
                href={`tel:${a.phone}`}
                className="block truncate text-[.8rem] text-lp-navy-mid hover:underline"
              >
                {a.phone}
              </a>
            </span>,
            <span key="o" className="text-[.86rem] text-lp-slate">
              {a.organization || "—"}
            </span>,
            <span key="s" className="flex flex-wrap items-center gap-1.5">
              <Pill tone="navy">{t(`appSource_${a.source}`)}</Pill>
              {a.locale && (
                <span className="text-[.74rem] font-bold uppercase text-lp-muted">
                  {a.locale}
                </span>
              )}
            </span>,
            /* Eskiz §4.1.8: consent has to be provable per recipient, so the
               list shows whether this lead may be texted at all. */
            a.smsConsentAt ? (
              <StatusDot key="c" tone="green">
                {t("appsConsentYes")}
              </StatusDot>
            ) : (
              <StatusDot key="c" tone="grey">
                {t("appsConsentNo")}
              </StatusDot>
            ),
            <span key="w" className="whitespace-nowrap text-[.84rem] text-lp-slate tabular-nums">
              {fmt(a.createdAt, locale)}
            </span>,
            <ApplicationStatusSelect key="st" applicationId={a.id} status={a.status} />,
          ])}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-lp-line-soft bg-lp-wash-alt px-6 py-4">
          <p className="text-[.8rem] text-lp-muted">{t("appsSlaNote")}</p>
          {pages > 1 && (
            <p className="text-[.8rem] text-lp-slate tabular-nums">
              {t("pageOf", { page, pages })}
            </p>
          )}
        </div>
      </Card>
    </>
  );
}

/** Only a value the enum knows becomes a filter; anything else is "any". */
function pick<T extends readonly string[]>(
  raw: string | undefined,
  allowed: T,
): T[number] | undefined {
  return raw && (allowed as readonly string[]).includes(raw)
    ? (raw as T[number])
    : undefined;
}

function fmt(d: Date, locale: Locale) {
  return new Date(d).toLocaleDateString(
    locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ",
    { day: "numeric", month: "short", timeZone: APP_TIME_ZONE },
  );
}


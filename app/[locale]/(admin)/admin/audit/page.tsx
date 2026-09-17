import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { auditRepository } from "@/lib/db/repositories/audit";
import { APP_TIME_ZONE, cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Card, CardToolbar, FilterChips, Table } from "@/components/admin/ui";
import type { Locale } from "@/lib/i18n/routing";

/** The prefixes worth filtering by — what people come here asking about. */
const TYPES = ["user", "course", "payment", "certificate", "application"] as const;

/**
 * The audit trail.
 *
 * Read-only by construction: nothing in the app updates or deletes a row, and
 * the footer says so, because a log people believe can be edited is not
 * evidence of anything.
 *
 * Action codes are coloured by how much they would cost to get wrong — money
 * and revocation read red, role and application changes gold, everything else
 * navy.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const me = await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const { type } = await searchParams;

  const active = (TYPES as readonly string[]).includes(type ?? "") ? type! : null;
  const all = await auditRepository.recentWithActor(200);
  const entries = active ? all.filter((e) => e.action.startsWith(active)) : all;

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navAudit")}
        title={t("auditTitle")}
        userId={me.id}
        role={me.role}
      />

      <Card>
        <CardToolbar>
          <FilterChips
            active={active}
            hrefFor={(v) => `/admin/audit${v ? `?type=${v}` : ""}`}
            options={[
              { value: null, label: t("filterAll"), count: all.length },
              ...TYPES.map((ty) => ({
                value: ty,
                label: t(`auditType_${ty}`),
                count: all.filter((e) => e.action.startsWith(ty)).length,
              })),
            ]}
          />
        </CardToolbar>

        <Table
          empty={t("noAudit")}
          head={[
            { label: t("colWhen") },
            { label: t("colActor") },
            { label: t("colAction") },
            { label: t("colEntity"), hide: true },
          ]}
          rows={entries.map((e) => [
            <span key="w" className="whitespace-nowrap text-[.84rem] text-lp-slate tabular-nums">
              {fmt(e.createdAt, locale)}
            </span>,
            <span key="a" className="flex items-center gap-2.5">
              <span
                aria-hidden
                className={cn(
                  "grid size-[26px] shrink-0 place-items-center rounded-full text-[.74rem] font-extrabold",
                  e.actorName ? "bg-lp-tint text-lp-navy" : "bg-lp-line-soft text-lp-muted",
                )}
              >
                {e.actorName ? e.actorName.slice(0, 1).toUpperCase() : "⚙"}
              </span>
              <span className="min-w-0 truncate text-[.86rem] text-lp-ink">
                {e.actorName || e.actorEmail || t("auditSystemActor")}
              </span>
            </span>,
            <span
              key="c"
              className={cn(
                "inline-block whitespace-nowrap rounded-md px-2 py-1 font-mono text-[.78rem] font-bold",
                severity(e.action),
              )}
            >
              {e.action}
            </span>,
            <span key="e" className="font-mono text-[.78rem] text-lp-muted">
              {e.entityType ? `${e.entityType}:${e.entityId?.slice(0, 8) ?? ""}` : "—"}
            </span>,
          ])}
        />

        <div className="border-t border-lp-line-soft bg-lp-wash-alt px-6 py-4">
          <p className="text-[.8rem] text-lp-muted">{t("auditRetentionNote")}</p>
        </div>
      </Card>
    </>
  );
}

function severity(action: string) {
  if (/fail|refund|revoke|delete/.test(action)) return "bg-lp-danger-tint text-lp-danger";
  if (action.startsWith("application") || action.startsWith("user.role"))
    return "bg-lp-gold-tint text-lp-gold-ink";
  return "bg-lp-tint text-lp-navy";
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

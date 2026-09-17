import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import {
  audienceRepository,
  type OccupationBreakdown,
} from "@/lib/db/repositories/audience";
import { settingsRepository } from "@/lib/db/repositories/settings";
import { PollVariantControl } from "@/components/admin/poll-variant-control";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Card, CardHead, Empty, KpiStrip } from "@/components/admin/ui";

const OCC_ORDER = [
  "student",
  "business_owner",
  "corporate_employee",
  "educator",
  "other",
] as const;

/** One colour per occupation, held constant across both cards so the two
    breakdowns can be compared by eye rather than by reading every label. */
const OCC_COLORS: Record<string, string> = {
  student: "bg-lp-navy-mid",
  business_owner: "bg-lp-gold",
  corporate_employee: "bg-lp-navy",
  educator: "bg-lp-success-dot",
  other: "bg-lp-line-strong",
};

export default async function AdminAudiencePage() {
  const viewer = await requireRole("super_admin", "accountant");
  const [t, tAud] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Audience"),
  ]);

  const [visitors, registrants, totals, recent, pollVariant] = await Promise.all([
    audienceRepository.visitorBreakdown(),
    audienceRepository.registrantBreakdown(),
    audienceRepository.pollTotals(),
    audienceRepository.signalsSince(30),
    settingsRepository.getPollVariant(),
  ]);

  const responseRate =
    totals.answered + totals.skipped > 0
      ? Math.round((totals.answered / (totals.answered + totals.skipped)) * 100)
      : 0;

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navAudience")}
        title={t("audienceTitle")}
        userId={viewer.id}
        role={viewer.role}
      />

      <div className="mb-[18px]">
        <KpiStrip
          cells={[
            {
              label: t("audResponses"),
              value: String(totals.answered),
              sub: `${t("audRecent")}: +${recent}`,
            },
            {
              label: t("audResponseRate"),
              value: `${responseRate}%`,
              sub: `${t("audAnswered")} ${totals.answered} · ${t("audSkipped")} ${totals.skipped}`,
            },
            {
              label: t("audRegistrants"),
              value: String(registrants.reduce((n, r) => n + r.count, 0)),
              sub: t("audRegistrantsSub"),
            },
            {
              label: t("audPollVariant"),
              value: pollVariant.toUpperCase(),
              sub: t("audPollVariantSub"),
            },
          ]}
        />
      </div>

      {viewer.role === "super_admin" && (
        <div className="mb-[18px]">
          <PollVariantControl current={pollVariant} />
        </div>
      )}

      <div className="grid gap-[18px] lg:grid-cols-2">
        <BreakdownCard
          title={t("audVisitors")}
          subtitle={t("audVisitorsSub")}
          data={visitors}
          label={(o) => tAud(`occ_${o}` as "occ_student")}
          emptyLabel={t("audNoData")}
        />
        <BreakdownCard
          title={t("audRegistrants")}
          subtitle={t("audRegistrantsSub")}
          data={registrants}
          label={(o) => tAud(`occ_${o}` as "occ_student")}
          emptyLabel={t("audNoData")}
        />
      </div>
    </>
  );
}

function BreakdownCard({
  title,
  subtitle,
  data,
  label,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  data: OccupationBreakdown;
  label: (o: string) => string;
  emptyLabel: string;
}) {
  const total = data.reduce((n, r) => n + r.count, 0);
  const byOcc = new Map(data.map((r) => [r.occupation, r.count]));

  return (
    <Card>
      <CardHead eyebrow={subtitle} title={title} />

      {total === 0 ? (
        <Empty>{emptyLabel}</Empty>
      ) : (
        <ul className="space-y-3 px-6 py-5">
          {OCC_ORDER.map((o) => {
            const c = byOcc.get(o) ?? 0;
            const pct = total > 0 ? Math.round((c / total) * 100) : 0;
            return (
              <li key={o}>
                <div className="flex items-center justify-between text-[.88rem]">
                  <span className="text-lp-ink">{label(o)}</span>
                  <span className="text-lp-slate tabular-nums">
                    {c} <span className="text-[.8rem] text-lp-muted">({pct}%)</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-lp-line-soft">
                  <div
                    className={`h-full rounded-full ${OCC_COLORS[o]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

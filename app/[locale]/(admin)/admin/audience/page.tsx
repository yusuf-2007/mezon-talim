import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import {
  audienceRepository,
  type OccupationBreakdown,
} from "@/lib/db/repositories/audience";
import { settingsRepository } from "@/lib/db/repositories/settings";
import { StatCard } from "@/components/admin/stat-card";
import { PollVariantControl } from "@/components/admin/poll-variant-control";

const OCC_ORDER = [
  "student",
  "business_owner",
  "corporate_employee",
  "educator",
  "other",
] as const;

const OCC_COLORS: Record<string, string> = {
  student: "bg-navy-600",
  business_owner: "bg-gold-500",
  corporate_employee: "bg-navy-800",
  educator: "bg-success",
  other: "bg-slate-400",
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
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-navy-800">
          {t("audienceTitle")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t("audienceSubtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("audResponses")}
          value={String(totals.answered)}
          sub={t("audRecent") + `: +${recent}`}
        />
        <StatCard
          label={t("audResponseRate")}
          value={`${responseRate}%`}
          sub={`${t("audAnswered")} ${totals.answered} · ${t("audSkipped")} ${totals.skipped}`}
        />
        <StatCard
          label={t("audRegistrants")}
          value={String(registrants.reduce((n, r) => n + r.count, 0))}
          sub={t("audRegistrantsSub")}
        />
      </div>

      {viewer.role === "super_admin" && (
        <PollVariantControl current={pollVariant} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
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
    </div>
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
    <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="font-heading text-lg font-semibold text-navy-800">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle}</p>

      {total === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {OCC_ORDER.map((o) => {
            const c = byOcc.get(o) ?? 0;
            const pct = total > 0 ? Math.round((c / total) * 100) : 0;
            return (
              <li key={o}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink">{label(o)}</span>
                  <span className="tabular-nums text-slate-500">
                    {c}{" "}
                    <span className="text-xs text-slate-400">({pct}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-navy-100">
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
    </div>
  );
}

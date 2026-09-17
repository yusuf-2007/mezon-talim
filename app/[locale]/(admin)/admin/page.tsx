import { ArrowRight, Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getAdminHome } from "@/lib/admin/dashboard";
import { formatTiyin } from "@/lib/payments";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { APP_TIME_ZONE, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { RevenueBars } from "@/components/admin/revenue-bars";
import { TimeAgo } from "@/components/time-ago";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Admin home — a work surface, not a report.
 *
 * It opens with what is waiting on a person: applications nobody rang back,
 * questions nobody answered, exam passes nobody turned into a certificate,
 * payments that stalled. Revenue and course numbers sit below, because they
 * describe what already happened and nothing about them needs doing today.
 */
export default async function AdminDashboardPage() {
  const me = await requireRole("super_admin", "accountant");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const canManage = me.role === "super_admin";
  const d = await getAdminHome(canManage);

  const paymentTrouble = d.queue.pendingPayments + d.queue.failedPayments;

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navDashboard")}
        title={t("homeTitle")}
        userId={me.id}
        role={me.role}
        action={
          canManage ? (
            <Button
              render={<Link href="/admin/courses/new" />}
              className="bg-lp-gold text-lp-navy-deep shadow-[0_4px_14px_rgba(248,184,1,.28)] hover:bg-lp-gold"
            >
              <Plus className="size-3.5" strokeWidth={2.5} />
              {t("homeNew")}
            </Button>
          ) : null
        }
      />

      {/* ── The queue ─────────────────────────────────────────────────── */}
      <Card className="mb-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lp-line-soft px-6 py-5">
          <p className="flex items-center gap-3">
            <span aria-hidden className="h-0.5 w-6 rounded bg-lp-gold" />
            <span className="font-lp-heading text-[1.2rem] font-semibold text-lp-navy">
              {t("queueTitle")}
            </span>
          </p>
          <p className="text-[.8rem] text-lp-muted">{t("queueFreshness")}</p>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          {canManage && (
            <QueueCell
              label={t("queueApplications")}
              count={d.queue.newApplications}
              unit={t("unitItems")}
              tone="gold"
              sub={t("queueApplicationsSub")}
              cta={t("queueApplicationsCta")}
              href="/admin/applications"
            />
          )}
          {canManage && (
            <QueueCell
              label={t("queueQuestions")}
              count={d.queue.openQuestions}
              unit={t("unitItems")}
              tone="gold"
              sub={
                d.queue.oldestQuestionAt
                  ? t("queueQuestionsSub", {
                      when: fmtDateTime(d.queue.oldestQuestionAt, locale),
                    })
                  : t("queueNothingWaiting")
              }
              cta={t("queueQuestionsCta")}
              href="/admin/messages"
            />
          )}
          {canManage && (
            <QueueCell
              label={t("queueCertificates")}
              count={d.queue.pendingCertificates}
              unit={t("unitItems")}
              tone="green"
              sub={t("queueCertificatesSub")}
              cta={t("queueCertificatesCta")}
              href="/admin/certificates"
            />
          )}
          <QueueCell
            label={t("queuePayments")}
            count={paymentTrouble}
            unit={t("unitItems")}
            tone="red"
            danger={paymentTrouble > 0}
            sub={t("queuePaymentsSub", {
              pending: d.queue.pendingPayments,
              failed: d.queue.failedPayments,
            })}
            cta={t("queuePaymentsCta")}
            href="/admin/payments"
          />
        </div>
      </Card>

      {/* ── Applications + questions ──────────────────────────────────── */}
      {canManage && (
        <div className="mb-[18px] grid gap-[18px] xl:grid-cols-[1.2fr_.8fr]">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-lp-line-soft px-6 py-5">
              <div>
                <p className="mb-1 text-[.74rem] font-bold uppercase tracking-[.14em] text-lp-gold-deep">
                  {t("appsEyebrow")}
                </p>
                <h2 className="font-lp-heading text-[1.2rem] font-semibold text-lp-navy">
                  {t("appsTitle")}
                </h2>
              </div>
              <GhostLink href="/admin/applications">
                {t("appsAll", {
                  count: d.queue.funnel.reduce((s, f) => s + f.count, 0),
                })}
              </GhostLink>
            </div>

            <div className="px-6 py-5">
              <Funnel steps={d.queue.funnel} t={t} />
            </div>

            {d.applications.length === 0 ? (
              <Empty>{t("appsEmpty")}</Empty>
            ) : (
              <Table
                head={[t("appsColName"), t("appsColSource"), t("appsColWhen")]}
                rows={d.applications.map((a) => [
                  <span key="n" className="block min-w-0">
                    <span className="block truncate font-semibold text-lp-ink">
                      {a.fullName}
                    </span>
                    <span className="block truncate text-[.8rem] text-lp-muted">
                      {[a.phone, a.organization].filter(Boolean).join(" · ")}
                    </span>
                  </span>,
                  <Pill key="s" tone="navy">
                    {t(sourceKey(a.source))}
                  </Pill>,
                  <TimeAgo key="w" iso={new Date(a.createdAt).toISOString()} />,
                ])}
              />
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-lp-line-soft px-6 py-5">
              <h2 className="font-lp-heading text-[1.2rem] font-semibold text-lp-navy">
                {t("questionsTitle")}
              </h2>
              <GhostLink href="/admin/messages">{t("questionsAll")}</GhostLink>
            </div>

            {d.threads.length === 0 ? (
              <Empty>{t("questionsEmpty")}</Empty>
            ) : (
              <ul>
                {d.threads.map((q) => (
                  <li key={q.id} className="border-b border-lp-line-soft last:border-b-0">
                    <Link
                      href={`/admin/messages?lesson=${q.lessonId}`}
                      className="block px-6 py-4 transition-colors hover:bg-lp-row-hover"
                    >
                      <span className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-[.9rem] font-bold text-lp-ink">
                          {q.studentName ?? "—"}
                        </span>
                        <SlaChip hours={q.ageHours} t={t} />
                      </span>
                      <span className="block font-lp-heading text-[1.05rem] font-medium italic leading-snug text-lp-navy">
                        &laquo;{q.body}&raquo;
                      </span>
                      <span className="mt-1 block truncate text-[.8rem] text-lp-muted">
                        {pickLocale(q.lessonTitle, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {paymentTrouble > 0 && (
              <div className="m-6 mt-4 rounded-xl border border-lp-gold-band bg-lp-gold-wash px-4 py-3">
                <p className="flex items-start gap-2.5 text-[.84rem] text-lp-gold-ink">
                  <span
                    aria-hidden
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-lp-gold"
                  />
                  <span>
                    {t("paymentsBanner", {
                      pending: d.queue.pendingPayments,
                      failed: d.queue.failedPayments,
                    })}{" "}
                    <Link href="/admin/payments" className="font-bold underline">
                      {t("paymentsBannerCta")}
                    </Link>
                  </span>
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Revenue + courses ─────────────────────────────────────────── */}
      <div className="mb-[18px] grid gap-[18px] xl:grid-cols-[1.15fr_.85fr]">
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3 px-6 pb-4 pt-5">
            <div>
              <p className="mb-1 text-[.74rem] font-bold uppercase tracking-[.14em] text-lp-gold-deep">
                {t("revenueEyebrow")}
              </p>
              <p className="font-lp-heading text-[1.9rem] font-semibold leading-none text-lp-navy tabular-nums">
                {formatTiyin(d.overview.totalRevenueTiyin, locale)}
              </p>
            </div>
            <p className="text-[.8rem] text-lp-muted">
              {t("revenueMeta", { count: d.overview.paidCount })}
            </p>
          </div>
          <div className="px-6 pb-6">
            <RevenueBars data={d.revenueByDay} locale={locale} emptyLabel={t("noSales")} />
          </div>
        </Card>

        <Card>
          <div className="border-b border-lp-line-soft px-6 py-5">
            <h2 className="font-lp-heading text-[1.2rem] font-semibold text-lp-navy">
              {t("topCourses")}
            </h2>
          </div>
          {d.courses.length === 0 ? (
            <Empty>{t("noData")}</Empty>
          ) : (
            <ul>
              {d.courses.map((c) => (
                <li
                  key={c.courseId}
                  className="flex items-center justify-between gap-4 border-b border-lp-line-soft px-6 py-3.5 last:border-b-0"
                >
                  <Link
                    href={`/studio/courses/${c.courseId}`}
                    className="min-w-0 truncate text-[.9rem] font-semibold text-lp-ink hover:text-lp-navy-mid"
                  >
                    {pickLocale(c.title, locale)}
                  </Link>
                  <span className="shrink-0 text-[.82rem] text-lp-muted tabular-nums">
                    {t("enrollCount", { count: c.enrollments })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Audit trail ───────────────────────────────────────────────── */}
      {canManage && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lp-line-soft px-6 py-5">
            <h2 className="font-lp-heading text-[1.2rem] font-semibold text-lp-navy">
              {t("activityTitle")}
            </h2>
            <GhostLink href="/admin/audit">{t("viewAll")}</GhostLink>
          </div>
          {d.activity.length === 0 ? (
            <Empty>{t("noData")}</Empty>
          ) : (
            <ul>
              {d.activity.map((a) => (
                <li
                  key={a.id}
                  className="grid grid-cols-[auto_22px_1fr] items-center gap-3 border-b border-lp-line-soft px-6 py-3 last:border-b-0"
                >
                  <span className="text-[.8rem] text-lp-muted tabular-nums">
                    {fmtTime(a.createdAt, locale)}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-[22px] place-items-center rounded-full",
                      auditTone(a.action).bg,
                    )}
                  >
                    <span
                      className={cn("size-1.5 rounded-full", auditTone(a.action).dot)}
                    />
                  </span>
                  <span className="min-w-0 truncate text-[.86rem] text-lp-ink">
                    <span className="font-mono text-[.82rem] text-lp-slate">{a.action}</span>
                    {a.actorName ? (
                      <span className="text-lp-muted"> · {a.actorName}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

/* ── Local pieces ──────────────────────────────────────────────────── */

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-lp-line bg-surface shadow-[0_2px_10px_rgba(2,58,105,.05)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-8 text-center text-[.88rem] text-lp-muted">{children}</p>;
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[.84rem] font-bold text-lp-navy-mid hover:underline"
    >
      {children}
      <ArrowRight className="size-3.5" strokeWidth={2.2} />
    </Link>
  );
}

const QUEUE_TONE = {
  gold: "bg-lp-gold",
  green: "bg-lp-success-dot",
  red: "bg-lp-danger",
} as const;

function QueueCell({
  label,
  count,
  unit,
  sub,
  cta,
  href,
  tone,
  danger = false,
}: {
  label: string;
  count: number;
  unit: string;
  sub: string;
  cta: string;
  href: string;
  tone: keyof typeof QUEUE_TONE;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className="block border-lp-line-soft px-6 py-5 transition-colors hover:bg-lp-row-hover sm:border-l sm:first:border-l-0 xl:border-l xl:first:border-l-0"
    >
      <span className="mb-2 flex items-center gap-2">
        <span aria-hidden className={cn("size-2 rounded-full", QUEUE_TONE[tone])} />
        <span className="text-[.8rem] font-bold text-lp-slate">{label}</span>
      </span>
      <span className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-lp-heading text-[2.1rem] font-semibold leading-none tabular-nums",
            danger ? "text-lp-danger" : "text-lp-navy",
          )}
        >
          {count}
        </span>
        <span className="text-[.82rem] text-lp-muted">{unit}</span>
      </span>
      <span className="mt-1.5 block text-[.8rem] leading-relaxed text-lp-muted">{sub}</span>
      <span className="mt-2.5 inline-flex items-center gap-1.5 text-[.82rem] font-bold text-lp-navy-mid">
        {cta}
        <ArrowRight className="size-3.5" strokeWidth={2.2} />
      </span>
    </Link>
  );
}

const FUNNEL_TONE = {
  new: "bg-lp-gold",
  contacted: "bg-lp-navy",
  enrolled: "bg-lp-success-dot",
  declined: "bg-lp-line-strong",
} as const;

function Funnel({
  steps,
  t,
}: {
  steps: { status: keyof typeof FUNNEL_TONE; count: number }[];
  t: Awaited<ReturnType<typeof getTranslations<"Admin">>>;
}) {
  const total = steps.reduce((s, x) => s + x.count, 0);
  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-lp-line-soft">
        {steps.map((s) => (
          <span
            key={s.status}
            className={FUNNEL_TONE[s.status]}
            style={{ width: total > 0 ? `${(s.count / total) * 100}%` : "0%" }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
        {steps.map((s) => (
          <span key={s.status} className="flex items-center gap-1.5 text-[.8rem]">
            <span
              aria-hidden
              className={cn("size-2 rounded-full", FUNNEL_TONE[s.status])}
            />
            <span className="font-bold text-lp-ink tabular-nums">{s.count}</span>
            <span className="text-lp-muted">{t(funnelKey(s.status))}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                className="border-b border-lp-line bg-lp-row-hover px-4 py-3 text-left text-[.74rem] font-bold uppercase tracking-[.1em] text-lp-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="transition-colors hover:bg-lp-row-hover">
              {cells.map((c, j) => (
                <td
                  key={j}
                  className="border-b border-lp-line-soft px-4 py-3.5 text-[.88rem] text-lp-ink"
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PILL_TONE = {
  navy: "bg-lp-tint text-lp-navy",
  gold: "bg-lp-gold-tint text-lp-gold-ink",
  green: "bg-lp-success-tint text-lp-success",
  grey: "bg-lp-line-soft text-lp-muted",
} as const;

function Pill({
  tone,
  children,
}: {
  tone: keyof typeof PILL_TONE;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[.74rem] font-bold",
        PILL_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

/**
 * How long a question has gone unanswered, coloured by the promise we make:
 * a reply within 24 hours. Past that it is red, not amber.
 */
function SlaChip({
  hours,
  t,
}: {
  hours: number;
  t: Awaited<ReturnType<typeof getTranslations<"Admin">>>;
}) {
  const tone =
    hours > 24
      ? "bg-lp-danger-tint text-lp-danger"
      : hours > 6
        ? "bg-lp-gold-tint text-lp-gold-ink"
        : "bg-lp-line-soft text-lp-muted";
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 text-[.74rem] font-bold tabular-nums", tone)}
    >
      {t("slaHours", { hours })}
    </span>
  );
}

/** Severity colouring for the audit dot: money and revocation read as red. */
function auditTone(action: string) {
  if (/fail|refund|revoke|delete/.test(action))
    return { bg: "bg-lp-danger-tint", dot: "bg-lp-danger" };
  if (action.startsWith("payment")) return { bg: "bg-lp-success-tint", dot: "bg-lp-success-dot" };
  if (action.startsWith("application") || action.startsWith("user.role"))
    return { bg: "bg-lp-gold-tint", dot: "bg-lp-gold" };
  return { bg: "bg-lp-tint", dot: "bg-lp-navy" };
}

function funnelKey(status: string) {
  return `appStatus_${status}` as Parameters<
    Awaited<ReturnType<typeof getTranslations<"Admin">>>
  >[0];
}

function sourceKey(source: string) {
  return `appSource_${source}` as Parameters<
    Awaited<ReturnType<typeof getTranslations<"Admin">>>
  >[0];
}

function dateLocale(locale: Locale) {
  return locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ";
}

function fmtTime(d: Date, locale: Locale) {
  return new Date(d).toLocaleTimeString(dateLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });
}

function fmtDateTime(d: Date, locale: Locale) {
  return new Date(d).toLocaleString(dateLocale(locale), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });
}

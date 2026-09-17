import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import {
  issueCertificateAction,
  revokeCertificateAction,
  reissueCertificateAction,
} from "@/lib/admin/actions";
import { pickLocale } from "@/lib/i18n/localized";
import { APP_TIME_ZONE } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/studio/confirm-submit";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  Card,
  CardToolbar,
  FilterChips,
  KpiStrip,
  SearchForm,
  StatusDot,
  Table,
} from "@/components/admin/ui";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Certificates: the queue of people who have earned one, then the ledger of
 * every one ever issued.
 *
 * Passing the exam does not mint the document. A person confirms the spelling
 * first, because the name goes on something with a public verification page and
 * a typo there outlives the mistake.
 */
export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const me = await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const { q, status } = await searchParams;

  const active = status === "active" || status === "revoked" ? status : null;

  const [counts, certs, pending] = await Promise.all([
    certificatesRepository.statusCounts(),
    certificatesRepository.listAll({ search: q, status: active ?? undefined }),
    certificatesRepository.pendingIssuance(50),
  ]);

  const href = (s: string | null) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (q) p.set("q", q);
    const qs = p.toString();
    return `/admin/certificates${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navCertificates")}
        title={t("certificatesTitle")}
        userId={me.id}
        role={me.role}
      />

      <div className="mb-[18px]">
        <KpiStrip
          cells={[
            { label: t("statCertsTotal"), value: String(counts.total) },
            { label: t("statCertsActive"), value: String(counts.active), tone: "green" },
            {
              label: t("statCertsRevoked"),
              value: String(counts.revoked),
              tone: counts.revoked > 0 ? "red" : undefined,
            },
            {
              label: t("certsPendingLabel"),
              value: String(pending.length),
              tone: pending.length > 0 ? "amber" : undefined,
            },
          ]}
        />
      </div>

      {/* The queue. Navy, because this is the one thing on the page that is
          asking for a decision rather than reporting one. */}
      {pending.length > 0 && (
        <section className="mb-[18px] overflow-hidden rounded-2xl bg-lp-navy shadow-[0_16px_40px_rgba(1,20,40,.22)]">
          <div className="px-7 pb-5 pt-6">
            <p className="mb-1.5 text-[.74rem] font-bold uppercase tracking-[.14em] text-lp-gold-light">
              {t("certsQueueEyebrow")}
            </p>
            <h2 className="font-lp-heading text-[1.2rem] font-semibold text-white">
              {t("certsQueueTitle", { count: pending.length })}
            </h2>
            <p className="mt-1.5 max-w-prose text-[.86rem] leading-relaxed text-lp-on-navy">
              {t("certsQueueNote")}
            </p>
          </div>
          <ul className="border-t border-white/10">
            {pending.map((p) => (
              <li
                key={`${p.userId}:${p.courseId}`}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-7 py-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-[.94rem] font-bold text-white">
                    {p.userName || p.userEmail || "—"}
                  </p>
                  <p className="truncate text-[.82rem] text-lp-on-navy-dim">
                    {pickLocale(p.courseTitle, locale)} ·{" "}
                    {t("certsQueueScore", { pct: p.scorePct, attempt: p.attemptNo })}
                  </p>
                </div>
                <form action={issueCertificateAction.bind(null, p.userId, p.courseId)}>
                  <Button
                    type="submit"
                    className="bg-lp-gold text-lp-navy-deep shadow-[0_4px_14px_rgba(248,184,1,.28)] hover:bg-lp-gold"
                  >
                    {t("certsIssue")}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card>
        <CardToolbar>
          <FilterChips
            active={active}
            hrefFor={href}
            options={[
              { value: null, label: t("filterAll"), count: counts.total },
              { value: "active", label: t("certActive"), count: counts.active },
              { value: "revoked", label: t("certRevoked"), count: counts.revoked },
            ]}
          />
          <SearchForm
            action="/admin/certificates"
            defaultValue={q}
            placeholder={t("searchCerts")}
            hidden={{ status: active ?? undefined }}
          />
        </CardToolbar>

        <Table
          empty={t("noCerts")}
          head={[
            { label: t("colCode") },
            { label: t("colStudent") },
            { label: t("colCourse"), hide: true },
            { label: t("colIssued"), hide: true },
            { label: t("colStatus") },
            { label: t("colActions"), align: "right" },
          ]}
          rows={certs.map((c) => [
            <span key="c" className="font-mono text-[.82rem] font-bold text-lp-navy tabular-nums">
              {c.verificationCode}
            </span>,
            <span key="s" className="block min-w-0 truncate font-semibold text-lp-ink">
              {c.userName || c.userEmail || "—"}
            </span>,
            <span key="co" className="block min-w-0 truncate text-[.86rem] text-lp-slate">
              {pickLocale(c.courseTitle, locale)}
            </span>,
            <span key="i" className="whitespace-nowrap text-[.84rem] text-lp-slate tabular-nums">
              {fmt(c.issuedAt, locale)}
            </span>,
            c.revokedAt ? (
              <StatusDot key="st" tone="red">
                {t("certRevoked")}
              </StatusDot>
            ) : (
              <StatusDot key="st" tone="green">
                {t("certActive")}
              </StatusDot>
            ),
            <span key="a" className="flex items-center justify-end gap-3">
              <a
                href={`/${locale}/verify/${c.verificationCode}`}
                target="_blank"
                rel="noreferrer"
                className="text-[.84rem] font-bold text-lp-navy-mid hover:underline"
              >
                {t("view")}
              </a>
              <a
                href={`/api/certificates/${c.verificationCode}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="text-[.84rem] font-bold text-lp-navy-mid hover:underline"
              >
                {t("downloadCert")}
              </a>
              {c.revokedAt ? (
                <form action={reissueCertificateAction.bind(null, c.id)}>
                  <ConfirmSubmit label={t("reissueCert")} />
                </form>
              ) : (
                <form action={revokeCertificateAction.bind(null, c.id)}>
                  <ConfirmSubmit label={t("revokeCert")} />
                </form>
              )}
            </span>,
          ])}
        />
      </Card>
    </>
  );
}

function fmt(d: Date, locale: Locale) {
  return new Date(d).toLocaleDateString(
    locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ",
    { day: "numeric", month: "short", year: "2-digit", timeZone: APP_TIME_ZONE },
  );
}

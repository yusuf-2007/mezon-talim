import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { Link } from "@/lib/i18n/navigation";
import { APP_TIME_ZONE } from "@/lib/utils";
import { RoleSelect } from "@/components/admin/role-select";
import { UserAvatar } from "@/components/admin/user-avatar";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  Card,
  CardToolbar,
  GhostLink,
  KpiStrip,
  SearchForm,
  StatusDot,
  Table,
} from "@/components/admin/ui";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Everyone with an account, and the two things an admin changes about them:
 * their role, and whether they are still active.
 *
 * Role is an inline select rather than a detail-page field — the job is almost
 * always "promote this one person", and a round trip through an edit form for
 * a single enum was the slowest part of it.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const { q } = await searchParams;

  const [users, roleCounts] = await Promise.all([
    usersRepository.listAll({ search: q, limit: 200 }),
    usersRepository.countByRole(),
  ]);

  const countFor = (...roles: string[]) =>
    roleCounts.filter((r) => roles.includes(r.role)).reduce((n, r) => n + r.count, 0);
  // Nothing proven at all — neither address nor number. An account with one
  // of the two confirmed can still be reached, so it is not the same problem.
  const unverified = users.filter((u) => !u.emailVerified && !u.phoneVerified).length;

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navUsers")}
        title={t("usersTitle")}
        userId={actor.id}
        role={actor.role}
      />

      <div className="mb-[18px]">
        <KpiStrip
          cells={[
            {
              label: t("statTotalUsers"),
              value: String(countFor("student", "teacher", "accountant", "super_admin")),
            },
            { label: t("statStudents"), value: String(countFor("student")) },
            {
              label: t("statAdmins"),
              value: String(countFor("super_admin", "accountant", "teacher")),
            },
            {
              label: t("statUnverified"),
              value: String(unverified),
              tone: unverified > 0 ? "amber" : undefined,
            },
          ]}
        />
      </div>

      <Card>
        <CardToolbar>
          <SearchForm
            action="/admin/users"
            defaultValue={q}
            placeholder={t("searchUsers")}
          />
        </CardToolbar>

        <Table
          empty={t("noUsers")}
          head={[
            { label: t("colName") },
            { label: t("colRole") },
            { label: t("colVerified"), hide: true },
            { label: t("colCourses"), hide: true },
            { label: t("colRegistered"), hide: true },
            { label: t("colStatus") },
            { label: t("colActions"), align: "right" },
          ]}
          rows={users.map((u) => [
            <span key="n" className="flex items-center gap-3">
              <UserAvatar
                name={u.fullName}
                email={u.email}
                src={u.hasAvatar ? `/api/avatars/${u.id}` : null}
              />
              <span className="block min-w-0">
                <Link
                  href={`/admin/users/${u.id}`}
                  className="block truncate font-semibold text-lp-ink hover:text-lp-navy-mid"
                >
                  {u.fullName || "—"}
                </Link>
                <span className="block truncate text-[.8rem] text-lp-muted">
                  {u.email || u.phone || "—"}
                </span>
              </span>
            </span>,
            /* Never let an admin demote themselves out of the room. */
            <RoleSelect key="r" userId={u.id} role={u.role} disabled={u.id === actor.id} />,
            /* Which credential is proven, not whether any is. The cell sits
               beside an email address, so a bare "Verified" on a phone-only
               account reads as a claim about the email that is not true. */
            <span key="v" className="flex flex-wrap gap-x-3 gap-y-1">
              {u.email && (
                <StatusDot tone={u.emailVerified ? "green" : "amber"}>
                  {t("verifiedEmail")}
                </StatusDot>
              )}
              {u.phone && (
                <StatusDot tone={u.phoneVerified ? "green" : "amber"}>
                  {t("verifiedPhone")}
                </StatusDot>
              )}
              {!u.email && !u.phone && (
                <StatusDot tone="grey">{t("verifiedNone")}</StatusDot>
              )}
            </span>,
            <span key="c" className="text-[.86rem] text-lp-slate tabular-nums">
              {t("coursesCount", { count: u.enrollmentCount })}
            </span>,
            <span key="d" className="whitespace-nowrap text-[.84rem] text-lp-slate tabular-nums">
              {fmt(u.createdAt, locale)}
            </span>,
            u.isActive ? (
              <StatusDot key="s" tone="green">
                {t("statusActive")}
              </StatusDot>
            ) : (
              <StatusDot key="s" tone="red">
                {t("statusInactive")}
              </StatusDot>
            ),
            <span key="a" className="flex justify-end">
              <GhostLink href={`/admin/users/${u.id}`}>{t("edit")}</GhostLink>
            </span>,
          ])}
        />

        <div className="border-t border-lp-line-soft bg-lp-wash-alt px-6 py-4">
          <p className="text-[.8rem] text-lp-muted">{t("usersHint")}</p>
        </div>
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

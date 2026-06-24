import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { lessonProgressRepository } from "@/lib/db/repositories/lesson-progress";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { userAvatarsRepository } from "@/lib/db/repositories/user-avatars";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/admin/user-avatar";
import type { Locale } from "@/lib/i18n/routing";

export default async function StudentProfilePage() {
  const sessionUser = await requireUser();
  const t = await getTranslations("Student");
  const locale = (await getLocale()) as Locale;

  const [user, enrolled, certs, hasAvatar] = await Promise.all([
    usersRepository.findById(sessionUser.id),
    enrollmentsRepository.listActiveWithCourse(sessionUser.id),
    certificatesRepository.listForUserAll(sessionUser.id),
    userAvatarsRepository.exists(sessionUser.id),
  ]);
  if (!user) notFound();

  const cards = await Promise.all(
    enrolled.map(async ({ course }) => {
      const lessonRows = await lessonsRepository.listByCourse(course.id);
      const ids = lessonRows.map((r) => r.lesson.id);
      const progress = await lessonProgressRepository.forLessons(sessionUser.id, ids);
      const completed = progress.filter((p) => p.completed).length;
      return ids.length > 0 && completed === ids.length;
    }),
  );
  const activeCerts = certs.filter((c) => !c.revokedAt);
  const tiles = [
    { label: t("statEnrolled"), value: enrolled.length },
    { label: t("statCompleted"), value: cards.filter(Boolean).length },
    { label: t("statCertificates"), value: activeCerts.length },
  ];
  const name = user.fullName || user.email || "—";
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString(locale === "ru" ? "ru-RU" : "uz-UZ");

  return (
    <div className="space-y-8">
      {/* Identity */}
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar
          name={user.fullName}
          email={user.email}
          src={hasAvatar ? `/api/avatars/${user.id}` : null}
          className="size-16 text-lg"
        />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold text-navy-800">{name}</h1>
            <Badge className="bg-navy-100 text-navy-800">{t("studentBadge")}</Badge>
          </div>
          <p className="text-sm text-slate-500">
            {user.email}
            {user.emailVerified && (
              <span className="ml-2 text-success">✓ {t("emailVerified")}</span>
            )}
          </p>
          <p className="text-xs text-slate-500">
            {t("joined")}: {fmtDate(user.createdAt)}
          </p>
        </div>
        <div className="ml-auto">
          <Button render={<Link href="/dashboard/profile/edit" />}>{t("editProfile")}</Button>
        </div>
      </div>

      {/* Bio */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <p className="text-sm font-medium text-navy-800">{t("bio")}</p>
        {user.bio ? (
          <p className="mt-2 whitespace-pre-line text-sm text-ink">{user.bio}</p>
        ) : (
          <Link
            href="/dashboard/profile/edit"
            className="mt-2 inline-block text-sm text-navy-600 hover:underline"
          >
            + {t("addBio")}
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((tile, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
            <p className="text-sm text-slate-500">{tile.label}</p>
            <p className="mt-2 font-heading text-2xl font-semibold text-navy-800 tabular-nums">
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      {/* Account details */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-navy-800">
          {t("accountDetails")}
        </h2>
        <dl className="mt-4 divide-y divide-line text-sm">
          <Row label={t("fullNameLabel")} value={user.fullName || "—"} />
          <Row
            label={t("emailLabel")}
            value={`${user.email || "—"}${user.emailVerified ? " ✓" : ""}`}
          />
          <Row label={t("accountType")} value={t("studentBadge")} />
        </dl>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button render={<Link href="/dashboard/profile/edit" />} variant="outline" size="sm">
          {t("editProfile")}
        </Button>
        <Button render={<Link href="/dashboard/certificates" />} variant="outline" size="sm">
          {t("viewCertificates")}
        </Button>
        <Button render={<Link href="/dashboard/courses" />} variant="outline" size="sm">
          {t("myCourses")}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { usersRepository } from "@/lib/db/repositories/users";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import { attemptsRepository } from "@/lib/db/repositories/attempts";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { lessonProgressRepository } from "@/lib/db/repositories/lesson-progress";
import {
  adminEnrollAction,
  grantRetryAction,
  issueCertificateAction,
  reissueCertificateAction,
  removeEnrollmentAction,
  resetProgressAction,
  revokeCertificateAction,
  setUserActiveAction,
  updateUserProfileAction,
} from "@/lib/admin/actions";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ConfirmSubmit } from "@/components/studio/confirm-submit";
import { CoursePicker } from "@/components/admin/course-picker";
import type { Locale } from "@/lib/i18n/routing";
import type { Role } from "@/lib/auth/types";

const ROLES: Role[] = ["student", "teacher", "accountant", "super_admin"];

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireRole("super_admin");
  const { userId } = await params;
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;

  const user = await usersRepository.findById(userId);
  if (!user) notFound();

  const [enrollments, attempts, certs, allCourses] = await Promise.all([
    enrollmentsRepository.listForUserWithCourse(userId),
    attemptsRepository.listForUserAll(userId),
    certificatesRepository.listForUserAll(userId),
    coursesRepository.listAll(),
  ]);

  // Progress per enrollment.
  const enrollmentRows = await Promise.all(
    enrollments.map(async ({ enrollment, course }) => {
      const lessonRows = await lessonsRepository.listByCourse(course.id);
      const ids = lessonRows.map((r) => r.lesson.id);
      const progress = await lessonProgressRepository.forLessons(userId, ids);
      const completed = progress.filter((p) => p.completed).length;
      const pct = ids.length ? Math.round((completed / ids.length) * 100) : 0;
      return { enrollment, course, pct };
    }),
  );

  // Group attempts by assessment → best score / count / passed.
  const groups = new Map<
    string,
    {
      assessment: (typeof attempts)[number]["assessment"];
      submitted: number;
      best: number | null;
      passed: boolean;
    }
  >();
  for (const { attempt, assessment } of attempts) {
    const g =
      groups.get(assessment.id) ??
      { assessment, submitted: 0, best: null, passed: false };
    if (attempt.submittedAt) {
      g.submitted += 1;
      if (attempt.scorePct != null)
        g.best = Math.max(g.best ?? 0, attempt.scorePct);
      if (attempt.passed) g.passed = true;
    }
    groups.set(assessment.id, g);
  }
  const allGroups = [...groups.values()];
  const quizGroups = allGroups.filter((g) => g.assessment.type !== "module_test");
  const moduleGroups = allGroups.filter((g) => g.assessment.type === "module_test");

  // Course pickers: not-yet-enrolled / not-actively-certified.
  const enrolledIds = new Set(enrollments.map((e) => e.course.id));
  const activeCertIds = new Set(
    certs.filter((c) => !c.revokedAt).map((c) => c.courseId),
  );
  const toLabel = (c: (typeof allCourses)[number]) => ({
    id: c.id,
    label: pickLocale(c.title, locale),
  });
  const enrollCandidates = allCourses.filter((c) => !enrolledIds.has(c.id)).map(toLabel);
  const certCandidates = allCourses.filter((c) => !activeCertIds.has(c.id)).map(toLabel);

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString(locale === "ru" ? "ru-RU" : "uz-UZ");
  const displayName = user.fullName || user.email || user.phone || "—";

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm text-navy-600 hover:underline">
        ← {t("usersTitle")}
      </Link>
      <div>
        <h1 className="font-heading text-2xl font-semibold text-navy-800">
          {displayName}
        </h1>
        <p className="text-sm text-slate-500">{user.email || user.phone}</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">{t("tabProfile")}</TabsTrigger>
          <TabsTrigger value="enrollments">
            {t("tabEnrollments")} ({enrollmentRows.length})
          </TabsTrigger>
          <TabsTrigger value="quizzes">
            {t("tabQuizzes")} ({quizGroups.length})
          </TabsTrigger>
          <TabsTrigger value="moduletests">
            {t("tabModuleTests")} ({moduleGroups.length})
          </TabsTrigger>
          <TabsTrigger value="certificates">
            {t("tabCertificates")} ({certs.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Profile ── */}
        <TabsContent value="profile" className="pt-6">
          <form
            action={updateUserProfileAction.bind(null, userId)}
            className="max-w-lg space-y-4 rounded-xl border border-line bg-surface p-6 shadow-sm"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">
                {t("profileName")}
              </label>
              <input
                name="fullName"
                defaultValue={user.fullName ?? ""}
                className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">
                {t("profileBio")}
              </label>
              <textarea
                name="bio"
                rows={2}
                defaultValue={user.bio ?? ""}
                className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-navy-800">
                  {t("profileRole")}
                </label>
                <select
                  name="role"
                  defaultValue={user.role}
                  className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`role_${r}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-navy-800">
                  {t("profileLocale")}
                </label>
                <select
                  name="locale"
                  defaultValue={user.locale}
                  className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm"
                >
                  <option value="uz">{t("localeUz")}</option>
                  <option value="ru">{t("localeRu")}</option>
                </select>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <Field label={t("profileEmail")} value={user.email ?? "—"} />
              <Field label={t("profilePhone")} value={user.phone ?? "—"} />
              <Field label={t("profileJoined")} value={fmtDate(user.createdAt)} />
            </dl>
            <Button type="submit">{t("saveProfile")}</Button>
          </form>

          {/* Account status */}
          <div className="mt-4 flex max-w-lg items-center justify-between rounded-xl border border-line bg-surface p-4 shadow-sm">
            <div>
              <p className="text-sm font-medium text-navy-800">{t("accountStatus")}</p>
              <p className="text-xs text-slate-500">
                {user.isActive ? t("statusActive") : t("statusInactive")}
              </p>
            </div>
            <form action={setUserActiveAction.bind(null, userId, !user.isActive)}>
              <Button type="submit" variant={user.isActive ? "outline" : "default"} size="sm">
                {user.isActive ? t("deactivate") : t("activate")}
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* ── Enrollments ── */}
        <TabsContent value="enrollments" className="space-y-4 pt-6">
          <CoursePicker
            userId={userId}
            courses={enrollCandidates}
            action={adminEnrollAction}
            buttonLabel={t("enroll")}
            placeholder={t("selectCourse")}
          />
          {enrollmentRows.length === 0 ? (
            <p className="text-sm text-slate-500">{t("noEnrollments")}</p>
          ) : (
            <ul className="space-y-3">
              {enrollmentRows.map(({ enrollment, course, pct }) => (
                <li
                  key={enrollment.id}
                  className="rounded-xl border border-line bg-surface p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-navy-800">
                        {pickLocale(course.title, locale)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t(`enr_${enrollment.status}`)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={resetProgressAction.bind(null, userId, course.id)}>
                        <ConfirmSubmit
                          label={t("resetProgress")}
                          confirmMessage={t("confirmReset")}
                        />
                      </form>
                      <form action={removeEnrollmentAction.bind(null, userId, course.id)}>
                        <ConfirmSubmit label={t("removeEnrollment")} />
                      </form>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-navy-100">
                      <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      {t("progressLabel")}: {pct}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* ── Quizzes ── */}
        <TabsContent value="quizzes" className="pt-6">
          <AttemptsTable groups={quizGroups} userId={userId} t={t} locale={locale} />
        </TabsContent>

        {/* ── Module tests ── */}
        <TabsContent value="moduletests" className="pt-6">
          <AttemptsTable groups={moduleGroups} userId={userId} t={t} locale={locale} />
        </TabsContent>

        {/* ── Certificates ── */}
        <TabsContent value="certificates" className="space-y-4 pt-6">
          <CoursePicker
            userId={userId}
            courses={certCandidates}
            action={issueCertificateAction}
            buttonLabel={t("issueCert")}
            placeholder={t("selectCourse")}
          />
          {certs.length === 0 ? (
            <p className="text-sm text-slate-500">{t("noCertificates")}</p>
          ) : (
            <ul className="space-y-3">
              {certs.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-navy-800">
                      {pickLocale(c.courseTitle, locale)}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {c.verificationCode} · {fmtDate(c.issuedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.revokedAt ? (
                      <Badge variant="destructive">{t("certRevoked")}</Badge>
                    ) : (
                      <Badge className="bg-success/10 text-success">{t("certActive")}</Badge>
                    )}
                    <a
                      href={`/api/certificates/${c.verificationCode}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-navy-600 hover:underline"
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function AttemptsTable({
  groups,
  userId,
  t,
  locale,
}: {
  groups: {
    assessment: {
      id: string;
      title: import("@/lib/db/schema").LocalizedText;
      maxAttempts: number | null;
    };
    submitted: number;
    best: number | null;
    passed: boolean;
  }[];
  userId: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  locale: Locale;
}) {
  if (groups.length === 0)
    return <p className="text-sm text-slate-500">{t("noAttempts")}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 font-medium">{t("colCourse")}</th>
            <th className="px-4 py-3 font-medium">{t("bestScore")}</th>
            <th className="px-4 py-3 font-medium">{t("quizAttempts")}</th>
            <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {groups.map((g, i) => (
            <tr key={i}>
              <td className="px-4 py-3 text-ink">{pickLocale(g.assessment.title, locale)}</td>
              <td className="px-4 py-3 tabular-nums text-navy-700">
                {g.best != null ? `${g.best}%` : "—"}
              </td>
              <td className="px-4 py-3 tabular-nums text-slate-600">
                {t("attemptsCount", { count: g.submitted })}
                {g.assessment.maxAttempts ? ` / ${g.assessment.maxAttempts}` : ""}
              </td>
              <td className="px-4 py-3">
                {g.submitted === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : g.passed ? (
                  <Badge className="bg-success/10 text-success">{t("passedLabel")}</Badge>
                ) : (
                  <Badge variant="destructive">{t("failedLabel")}</Badge>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {g.submitted > 0 && (
                  <form action={grantRetryAction.bind(null, userId, g.assessment.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      {t("grantRetry")}
                    </Button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

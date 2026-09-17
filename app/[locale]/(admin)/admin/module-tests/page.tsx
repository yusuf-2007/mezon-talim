import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { attemptsRepository } from "@/lib/db/repositories/attempts";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { pickLocale } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils";
import { CourseFilter } from "@/components/admin/course-filter";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  Banner,
  Card,
  CardHead,
  Empty,
  GhostLink,
  Pill,
} from "@/components/admin/ui";
import type { Locale } from "@/lib/i18n/routing";

const PASS_THRESHOLD_HINT = 70;

/**
 * Module tests, one course at a time.
 *
 * Replaces a ComingSoon stub. The point of the page is the gap: sequential
 * unlock means a module with no test is a wall, and until now nothing told
 * anyone that the wall existed — a student simply stopped, and the reason
 * lived in `curriculum.ts` rather than on a screen.
 */
export default async function AdminModuleTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const me = await requireRole("super_admin");
  const t = await getTranslations("Admin");
  const locale = (await getLocale()) as Locale;
  const { courseId } = await searchParams;

  const courses = await coursesRepository.listAll();
  const selected = courseId ?? courses[0]?.id;

  const [modules, tests] = await Promise.all([
    selected ? modulesRepository.listByCourse(selected) : Promise.resolve([]),
    attemptsRepository.byAssessment("module_test"),
  ]);

  const testByModule = new Map(
    tests.filter((x) => x.moduleId).map((x) => [x.moduleId!, x]),
  );
  const missing = modules.filter((m) => !testByModule.has(m.id));

  return (
    <>
      <AdminPageHeader
        eyebrow={t("navModuleTests")}
        title={t("moduleTestsTitle")}
        userId={me.id}
        role={me.role}
      />

      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <CourseFilter
          courses={courses.map((c) => ({ id: c.id, label: pickLocale(c.title, locale) }))}
          current={selected ?? ""}
          placeholder={t("enrollmentsSelectCourse")}
        />
        <p className="max-w-prose text-[.82rem] text-lp-muted">
          {t("moduleTestsRule", { pct: PASS_THRESHOLD_HINT })}
        </p>
      </div>

      {missing.length > 0 && (
        <Banner tone="warn" className="mb-[18px]">
          {/* Naming the consequence, not just the absence: the sequential-unlock
              rule is what turns a missing test into a stuck student. */}
          {t("moduleTestsMissing", {
            count: missing.length,
            first: missing[0] ? pickLocale(missing[0].title, locale) : "",
          })}
        </Banner>
      )}

      <Card>
        <CardHead title={t("moduleTestsListTitle")} />
        {modules.length === 0 ? (
          <Empty>{t("noData")}</Empty>
        ) : (
          <ul>
            {modules.map((m, i) => {
              const test = testByModule.get(m.id);
              const passed = Number(test?.passed ?? 0);
              const failed = Number(test?.failed ?? 0);
              const total = passed + failed;
              const rate = total > 0 ? Math.round((passed / total) * 100) : null;

              return (
                <li
                  key={m.id}
                  className="grid items-center gap-4 border-b border-lp-line-soft px-6 py-5 last:border-b-0 sm:grid-cols-[3.5rem_1fr_auto]"
                >
                  <span
                    className={cn(
                      "font-lp-heading text-[1.65rem] font-semibold leading-none tabular-nums",
                      test ? "text-lp-line-strong" : "text-lp-gold-muted",
                    )}
                  >
                    {i + 1}
                  </span>

                  <span className="min-w-0">
                    <span className="block truncate text-[.98rem] font-bold text-lp-ink">
                      {pickLocale(m.title, locale)}
                    </span>
                    {test ? (
                      <>
                        <span className="mt-1.5 flex max-w-[18rem] items-center gap-2.5">
                          <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-lp-line-soft">
                            <span
                              className={cn(
                                "block h-full rounded-full",
                                rate != null && rate >= PASS_THRESHOLD_HINT
                                  ? "bg-lp-success-dot"
                                  : "bg-lp-gold",
                              )}
                              style={{ width: `${rate ?? 0}%` }}
                            />
                          </span>
                          <span className="shrink-0 text-[.8rem] text-lp-slate tabular-nums">
                            {rate != null ? `${rate}%` : "—"}
                          </span>
                        </span>
                        <span className="mt-1 block text-[.8rem] text-lp-muted">
                          {t("moduleTestsAttempts", { count: total })}
                        </span>
                      </>
                    ) : (
                      <span className="mt-1 block text-[.82rem] text-lp-gold-ink">
                        {t("moduleTestsNone")}
                      </span>
                    )}
                  </span>

                  <span className="flex items-center gap-3 justify-self-start sm:justify-self-end">
                    <Pill tone={test ? (test.isPublished ? "green" : "grey") : "gold"}>
                      {test
                        ? test.isPublished
                          ? t("status_published")
                          : t("status_draft")
                        : t("moduleTestsMissingPill")}
                    </Pill>
                    {selected && (
                      <GhostLink href={`/admin/courses/${selected}/assessments`}>
                        {test ? t("edit") : t("moduleTestsCreate")}
                      </GhostLink>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

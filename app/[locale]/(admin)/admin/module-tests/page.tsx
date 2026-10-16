import { getLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { attemptsRepository } from "@/lib/db/repositories/attempts";
import { certificatesRepository } from "@/lib/db/repositories/certificates";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { pickLocale } from "@/lib/i18n/localized";
import { moduleCertificatesActive } from "@/lib/learning/modules";
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

/**
 * Module exams (the `module_test` assessment), one course at a time.
 *
 * The rules this page describes: a module exam opens once that module's
 * lessons are done; passing it (with the lessons done) earns the module
 * certificate when the course has module certificates on; the course final
 * opens after every PUBLISHED module exam is passed. Modules unlock lesson by
 * lesson, never by test — so a module with no exam does not stop anyone, it
 * just has no module certificate. That gap is what the banner names.
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

  const course = courses.find((c) => c.id === selected) ?? null;

  const [modules, stats, examByModule, certsByModule] = await Promise.all([
    selected ? modulesRepository.listByCourse(selected) : Promise.resolve([]),
    attemptsRepository.byAssessment("module_test"),
    selected
      ? assessmentsRepository.listModuleExamsByCourse(selected)
      : Promise.resolve(new Map<string, never>()),
    selected
      ? certificatesRepository.countActiveModuleCertsByCourse(selected)
      : Promise.resolve(new Map<string, number>()),
  ]);

  // The module's exam is the same deterministic pick the student side uses
  // (published first, then oldest), so a legacy duplicate is never the one
  // shown here while students see the other.
  const statsById = new Map(stats.map((x) => [x.assessmentId, x]));
  const missing = modules.filter((m) => !examByModule.has(m.id));
  const certsOn = course ? moduleCertificatesActive(course) : false;

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
          {t("moduleTestsRule")}
        </p>
      </div>

      {course && !certsOn && (
        <Banner tone="info" className="mb-[18px]">
          {t("moduleTestsCertsOff")}
        </Banner>
      )}

      {missing.length > 0 && (
        <Banner tone="warn" className="mb-[18px]">
          {/* Naming the consequence, not just the absence: a module with no
              exam can never issue its module certificate. */}
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
              const test = examByModule.get(m.id);
              const stat = test ? statsById.get(test.id) : undefined;
              const passed = Number(stat?.passed ?? 0);
              const failed = Number(stat?.failed ?? 0);
              const total = passed + failed;
              const rate = total > 0 ? Math.round((passed / total) * 100) : null;
              const certCount = certsByModule.get(m.id) ?? 0;

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
                                rate != null && rate >= test.passThresholdPct
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
                          {t("moduleTestsAttempts", { count: total })} ·{" "}
                          {t("moduleTestsPassMark", { pct: test.passThresholdPct })}
                          {certsOn && (
                            <> · {t("moduleTestsCerts", { count: certCount })}</>
                          )}
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

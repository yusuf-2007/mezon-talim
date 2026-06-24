import { getTranslations } from "next-intl/server";
import { createModuleAction, updateCourseAction } from "@/lib/content/actions";
import { Link } from "@/lib/i18n/navigation";
import { CourseForm } from "./course-form";
import { CourseStatusControls } from "./course-status-controls";
import { AddModuleForm } from "./add-module-form";
import { ModuleCard } from "./module-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { coursesRepository } from "@/lib/db/repositories/courses";
import type { modulesRepository } from "@/lib/db/repositories/modules";

type Course = NonNullable<
  Awaited<ReturnType<typeof coursesRepository.findById>>
>;
type Modules = Awaited<ReturnType<typeof modulesRepository.listByCourse>>;

/**
 * The course authoring editor — details form + status controls + curriculum
 * builder. Shared between the Studio (`/studio/...`) and the Admin
 * (`/admin/...`) so admins get the full authoring capability without a
 * duplicated editor (one source of truth). The nav hrefs are parameterized so
 * each surface keeps its own back-link and assessments route.
 */
export async function CourseEditor({
  courseId,
  course,
  modules,
  backHref,
  backLabel,
  assessmentsHref,
}: {
  courseId: string;
  course: Course;
  modules: Modules;
  backHref: string;
  backLabel: string;
  assessmentsHref: string;
}) {
  const t = await getTranslations("Studio");

  return (
    <>
      <Link href={backHref} className="text-sm text-navy-600 hover:underline">
        ← {backLabel}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-heading text-3xl font-semibold text-navy-800">
          {course.title.uz}
        </h1>
      </div>

      <div className="mt-4">
        <CourseStatusControls courseId={courseId} status={course.status} />
      </div>

      <div className="mt-4">
        <Link
          href={assessmentsHref}
          className="text-sm font-medium text-navy-600 hover:underline"
        >
          {t("assessmentsLink")} →
        </Link>
      </div>

      {/* Course details */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="font-heading text-xl text-navy-800">
            {t("courseDetails")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CourseForm
            action={updateCourseAction.bind(null, courseId)}
            course={course}
            submitLabel={t("save")}
          />
        </CardContent>
      </Card>

      {/* Curriculum */}
      <div className="mt-10">
        <h2 className="font-heading text-2xl font-semibold text-navy-800">
          {t("curriculum")}
        </h2>

        <div className="mt-4 space-y-4">
          {modules.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-slate-500">
              {t("noModules")}
            </p>
          ) : (
            modules.map((m, i) => (
              <ModuleCard key={m.id} courseId={courseId} module={m} index={i} />
            ))
          )}
        </div>

        <div className="mt-6 rounded-xl border border-line bg-surface p-5">
          <AddModuleForm action={createModuleAction.bind(null, courseId)} />
        </div>
      </div>
    </>
  );
}

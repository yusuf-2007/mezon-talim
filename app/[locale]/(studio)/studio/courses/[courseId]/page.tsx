import { getTranslations } from "next-intl/server";
import { requireCourseEditor } from "@/lib/content/access";
import { modulesRepository } from "@/lib/db/repositories/modules";
import {
  createModuleAction,
  updateCourseAction,
} from "@/lib/content/actions";
import { Link } from "@/lib/i18n/navigation";
import { CourseForm } from "@/components/studio/course-form";
import { CourseStatusControls } from "@/components/studio/course-status-controls";
import { AddModuleForm } from "@/components/studio/add-module-form";
import { ModuleCard } from "@/components/studio/module-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const { course } = await requireCourseEditor(courseId);
  const t = await getTranslations("Studio");
  const modules = await modulesRepository.listByCourse(courseId);

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link href="/studio" className="text-sm text-navy-600 hover:underline">
        ← {t("backToStudio")}
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
          href={`/studio/courses/${courseId}/assessments`}
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
    </section>
  );
}

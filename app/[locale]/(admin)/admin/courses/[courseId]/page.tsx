import { getTranslations } from "next-intl/server";
import { requireCourseEditor } from "@/lib/content/access";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { CourseEditor } from "@/components/studio/course-editor";

/**
 * Admin course editor — reuses the same CourseEditor as the Studio (one source
 * of truth), so a super_admin gets full authoring without leaving /admin.
 * Auth via requireCourseEditor: super_admin may edit any course; accountants are
 * rejected (no authoring).
 */
export default async function AdminEditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const { course } = await requireCourseEditor(courseId);
  const t = await getTranslations("Admin");
  const modules = await modulesRepository.listByCourse(courseId);

  return (
    <div className="mx-auto max-w-4xl">
      <CourseEditor
        courseId={courseId}
        course={course}
        modules={modules}
        backHref="/admin/courses"
        backLabel={t("coursesTitle")}
        assessmentsHref={`/admin/courses/${courseId}/assessments`}
      />
    </div>
  );
}

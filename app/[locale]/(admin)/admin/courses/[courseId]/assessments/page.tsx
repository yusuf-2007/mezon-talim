import { requireCourseEditor } from "@/lib/content/access";
import { AssessmentsList } from "@/components/studio/assessments-list";

export default async function AdminAssessmentsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  await requireCourseEditor(courseId);
  return (
    <div className="mx-auto max-w-4xl">
      <AssessmentsList courseId={courseId} basePath="/admin" />
    </div>
  );
}

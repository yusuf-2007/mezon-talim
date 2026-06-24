import { requireCourseEditor } from "@/lib/content/access";
import { AssessmentEditor } from "@/components/studio/assessment-editor";

export default async function AdminAssessmentEditorPage({
  params,
}: {
  params: Promise<{ courseId: string; assessmentId: string }>;
}) {
  const { courseId, assessmentId } = await params;
  await requireCourseEditor(courseId);
  return (
    <div className="mx-auto max-w-4xl">
      <AssessmentEditor
        courseId={courseId}
        assessmentId={assessmentId}
        basePath="/admin"
      />
    </div>
  );
}

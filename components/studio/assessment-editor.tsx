import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { questionsRepository } from "@/lib/db/repositories/questions";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import {
  createQuestionAction,
  deleteAssessmentAction,
  deleteQuestionAction,
  updateAssessmentAction,
  updateQuestionAction,
} from "@/lib/assessments/studio-actions";
import { Link } from "@/lib/i18n/navigation";
import { AssessmentForm } from "./assessment-form";
import { AddQuestion, QuestionRow } from "./question-editor";
import { ConfirmSubmit } from "./confirm-submit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Assessment settings + question editor. Shared between Studio and Admin via
 * `basePath` so the back link and the delete redirect stay on the author's
 * surface. Question/update actions only revalidate, so they refresh in place.
 */
export async function AssessmentEditor({
  courseId,
  assessmentId,
  basePath,
}: {
  courseId: string;
  assessmentId: string;
  basePath: string;
}) {
  const t = await getTranslations("Assess");

  const assessment = await assessmentsRepository.findById(assessmentId);
  if (!assessment || assessment.courseId !== courseId) notFound();

  const [questions, modules, lessonRows] = await Promise.all([
    questionsRepository.listByAssessment(assessmentId),
    modulesRepository.listByCourse(courseId),
    lessonsRepository.listByCourse(courseId),
  ]);
  const lessons = lessonRows.map((r) => ({ id: r.lesson.id, title: r.lesson.title }));

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`${basePath}/courses/${courseId}/assessments`}
          className="text-sm text-navy-600 hover:underline"
        >
          ← {t("back")}
        </Link>
        <form action={deleteAssessmentAction.bind(null, basePath, courseId, assessmentId)}>
          <ConfirmSubmit label={t("delete")} />
        </form>
      </div>

      {/* Settings */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="font-heading text-xl text-navy-800">
            {t("settings")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AssessmentForm
            action={updateAssessmentAction.bind(null, courseId, assessmentId)}
            submitLabel={t("save")}
            modules={modules.map((m) => ({ id: m.id, title: m.title }))}
            lessons={lessons}
            assessment={assessment}
          />
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="mt-10">
        <h2 className="font-heading text-2xl font-semibold text-navy-800">
          {t("questions")}
        </h2>
        {questions.length === 0 ? (
          <p className="mt-4 text-slate-500">{t("noQuestions")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {questions.map((q, i) => (
              <QuestionRow
                key={q.id}
                index={i}
                question={{
                  type: q.type,
                  prompt: q.prompt,
                  explanation: q.explanation,
                  options: q.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
                }}
                updateAction={updateQuestionAction.bind(null, courseId, assessmentId, q.id)}
                deleteAction={deleteQuestionAction.bind(null, courseId, assessmentId, q.id)}
              />
            ))}
          </ul>
        )}
        <div className="mt-6">
          <AddQuestion action={createQuestionAction.bind(null, courseId, assessmentId)} />
        </div>
      </div>
    </>
  );
}

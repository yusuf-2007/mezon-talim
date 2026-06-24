import { getLocale, getTranslations } from "next-intl/server";
import { assessmentsRepository } from "@/lib/db/repositories/assessments";
import { questionsRepository } from "@/lib/db/repositories/questions";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { createAssessmentAction } from "@/lib/assessments/studio-actions";
import { pickLocale } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { AssessmentForm } from "./assessment-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Assessments list + create form for a course. Shared between Studio and Admin
 * via `basePath` ("/studio" | "/admin") so the create action redirects back to
 * the surface the author is on.
 */
export async function AssessmentsList({
  courseId,
  basePath,
}: {
  courseId: string;
  basePath: string;
}) {
  const t = await getTranslations("Assess");
  const locale = await getLocale();

  const [list, modules, lessonRows] = await Promise.all([
    assessmentsRepository.listByCourse(courseId),
    modulesRepository.listByCourse(courseId),
    lessonsRepository.listByCourse(courseId),
  ]);
  const counts = new Map<string, number>();
  await Promise.all(
    list.map(async (a) =>
      counts.set(a.id, await questionsRepository.countByAssessment(a.id)),
    ),
  );
  const lessons = lessonRows.map((r) => ({ id: r.lesson.id, title: r.lesson.title }));

  return (
    <>
      <Link href={`${basePath}/courses/${courseId}`} className="text-sm text-navy-600 hover:underline">
        ← {t("back")}
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-semibold text-navy-800">
        {t("title")}
      </h1>

      {list.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line bg-surface p-8 text-center text-slate-500">
          {t("noAssessments")}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((a) => (
            <li key={a.id}>
              <Link
                href={`${basePath}/courses/${courseId}/assessments/${a.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <p className="font-medium text-navy-800">{pickLocale(a.title, locale)}</p>
                  <p className="text-xs text-slate-500">
                    {t("questionsCount", { count: counts.get(a.id) ?? 0 })}
                  </p>
                </div>
                <Badge className="bg-navy-100 text-navy-800">{t(`type_${a.type}`)}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-10">
        <CardHeader>
          <CardTitle className="font-heading text-xl text-navy-800">
            {t("newAssessment")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AssessmentForm
            action={createAssessmentAction.bind(null, basePath, courseId)}
            submitLabel={t("create")}
            modules={modules.map((m) => ({ id: m.id, title: m.title }))}
            lessons={lessons}
          />
        </CardContent>
      </Card>
    </>
  );
}

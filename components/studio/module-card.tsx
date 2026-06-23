import { getTranslations } from "next-intl/server";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import {
  createLessonAction,
  deleteLessonAction,
  deleteModuleAction,
  updateLessonAction,
  updateModuleAction,
} from "@/lib/content/actions";
import { ModuleHeader } from "./module-header";
import { AddLesson, LessonRow } from "./lesson-list";

type ModuleLike = {
  id: string;
  title: { uz: string; ru?: string };
};

/**
 * Server component for one module: header (rename/delete), its lessons (each
 * editable/deletable), and an add-lesson affordance. Per-resource server
 * actions are bound here with courseId/moduleId/lessonId before being handed to
 * the client rows.
 */
export async function ModuleCard({
  courseId,
  module,
  index,
}: {
  courseId: string;
  module: ModuleLike;
  index: number;
}) {
  const t = await getTranslations("Studio");
  const lessons = await lessonsRepository.listByModule(module.id);

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <ModuleHeader
        title={module.title}
        index={index}
        updateAction={updateModuleAction.bind(null, courseId, module.id)}
        deleteAction={deleteModuleAction.bind(null, courseId, module.id)}
      />

      {lessons.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t("noLessons")}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {lessons.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              updateAction={updateLessonAction.bind(null, courseId, lesson.id)}
              deleteAction={deleteLessonAction.bind(null, courseId, lesson.id)}
            />
          ))}
        </ul>
      )}

      <div className="mt-4">
        <AddLesson action={createLessonAction.bind(null, courseId, module.id)} />
      </div>
    </div>
  );
}

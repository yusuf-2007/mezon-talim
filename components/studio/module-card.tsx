import { getTranslations } from "next-intl/server";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { videoQuestionsRepository } from "@/lib/db/repositories/video-questions";
import {
  createLessonAction,
  deleteLessonAction,
  deleteModuleAction,
  updateLessonAction,
  updateModuleAction,
} from "@/lib/content/actions";
import { deleteVideoQuestionAction } from "@/lib/content/video-question-actions";
import { pickLocale } from "@/lib/i18n/localized";
import { ModuleHeader } from "./module-header";
import { AddLesson, LessonRow } from "./lesson-list";
import { VideoQuestionsEditor } from "./video-questions-editor";

function fmtTime(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

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
          {await Promise.all(
            lessons.map(async (lesson) => {
              const vqs = await videoQuestionsRepository.listForLesson(lesson.id);
              return (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  updateAction={updateLessonAction.bind(null, courseId, lesson.id)}
                  deleteAction={deleteLessonAction.bind(null, courseId, lesson.id)}
                  videoQuestionsCount={vqs.length}
                  videoQuestionsSlot={
                    <VideoQuestionsEditor
                      lessonId={lesson.id}
                      deleteAction={deleteVideoQuestionAction}
                      questions={vqs.map((q) => ({
                        id: q.id,
                        time: fmtTime(q.timestampSeconds),
                        prompt: pickLocale(q.prompt, "uz") ?? "",
                        options: q.options.map((o) => pickLocale(o, "uz") ?? ""),
                        correctIndex: q.correctIndex,
                      }))}
                    />
                  }
                />
              );
            }),
          )}
        </ul>
      )}

      <div className="mt-4">
        <AddLesson action={createLessonAction.bind(null, courseId, module.id)} />
      </div>
    </div>
  );
}

import "server-only";
import { modulesRepository } from "@/lib/db/repositories/modules";
import { lessonsRepository } from "@/lib/db/repositories/lessons";
import { lessonProgressRepository } from "@/lib/db/repositories/lesson-progress";
import { enrollmentsRepository } from "@/lib/db/repositories/enrollments";
import type { LocalizedText } from "@/lib/db/schema";

export type CurriculumLesson = {
  id: string;
  title: LocalizedText;
  durationSeconds: number | null;
  isPreview: boolean;
  hasVideo: boolean;
  completed: boolean;
  /** Student may open it: preview, or (enrolled AND sequentially unlocked). */
  accessible: boolean;
};

export type CurriculumModule = {
  id: string;
  title: LocalizedText;
  lessons: CurriculumLesson[];
};

export type Curriculum = {
  modules: CurriculumModule[];
  lessonCount: number;
  completedCount: number;
  enrolled: boolean;
  /** First non-completed accessible lesson — drives "continue"/resume (B3). */
  resumeLessonId: string | null;
};

/**
 * Build the course curriculum for a viewer, applying enrollment + sequential
 * unlock (B2). When `userId` is null (anonymous), only preview lessons are
 * accessible. Pure read model used by the course-detail page and the player.
 */
export async function getCurriculum(
  courseId: string,
  userId: string | null,
): Promise<Curriculum> {
  const [moduleRows, lessonRows] = await Promise.all([
    modulesRepository.listByCourse(courseId),
    lessonsRepository.listByCourse(courseId),
  ]);

  const enrolled = userId
    ? await enrollmentsRepository.isActive(userId, courseId)
    : false;

  const lessonIds = lessonRows.map((r) => r.lesson.id);
  const progress = userId
    ? await lessonProgressRepository.forLessons(userId, lessonIds)
    : [];
  const completedSet = new Set(
    progress.filter((p) => p.completed).map((p) => p.lessonId),
  );

  // Flatten in curriculum order to compute sequential unlock.
  const ordered = lessonRows.map((r) => r.lesson);
  const accessibleSet = new Set<string>();
  let prevCompleted = true; // the first lesson is always unlocked for enrolled
  for (const lesson of ordered) {
    const completed = completedSet.has(lesson.id);
    const unlocked = enrolled && prevCompleted;
    if (lesson.isPreview || unlocked) accessibleSet.add(lesson.id);
    prevCompleted = completed;
  }

  const byModule = new Map<string, CurriculumLesson[]>();
  for (const { lesson } of lessonRows) {
    const entry: CurriculumLesson = {
      id: lesson.id,
      title: lesson.title,
      durationSeconds: lesson.durationSeconds,
      isPreview: lesson.isPreview,
      hasVideo: Boolean(lesson.bunnyVideoId),
      completed: completedSet.has(lesson.id),
      accessible: accessibleSet.has(lesson.id),
    };
    const list = byModule.get(lesson.moduleId) ?? [];
    list.push(entry);
    byModule.set(lesson.moduleId, list);
  }

  const modules: CurriculumModule[] = moduleRows.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: byModule.get(m.id) ?? [],
  }));

  const resumeLessonId =
    ordered.find((l) => accessibleSet.has(l.id) && !completedSet.has(l.id))?.id ??
    ordered.find((l) => accessibleSet.has(l.id))?.id ??
    null;

  return {
    modules,
    lessonCount: ordered.length,
    completedCount: completedSet.size,
    enrolled,
    resumeLessonId,
  };
}

/** Flatten a curriculum back into lesson order. */
export function flattenLessons(c: Curriculum): CurriculumLesson[] {
  return c.modules.flatMap((m) => m.lessons);
}

/** Find a lesson + its previous/next neighbours within the curriculum. */
export function locateLesson(c: Curriculum, lessonId: string) {
  const flat = flattenLessons(c);
  const index = flat.findIndex((l) => l.id === lessonId);
  if (index === -1) {
    return { lesson: null, prevId: null, nextId: null };
  }
  return {
    lesson: flat[index],
    prevId: index > 0 ? flat[index - 1].id : null,
    nextId: index < flat.length - 1 ? flat[index + 1].id : null,
  };
}

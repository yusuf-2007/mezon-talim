import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { getCurriculum } from "@/lib/learning/curriculum";
import { getFinalExamBox } from "@/lib/assessments/service";
import { PlayerSidebar } from "./player-sidebar";

/**
 * Shared course-player layout: the curriculum rail on the left, content on the
 * right. Used by the lesson player AND the exam pages so moving into the exam
 * keeps the same shell — only the main content swaps from video to exam.
 *
 * `activeLessonId` highlights the current lesson; pass "exam" to highlight the
 * final-exam box instead (when the exam is the active view).
 */
export async function CoursePlayerShell({
  courseId,
  courseSlug,
  userId,
  activeLessonId,
  children,
}: {
  courseId: string;
  courseSlug: string;
  userId: string;
  activeLessonId: string;
  children: React.ReactNode;
}) {
  const [t, curriculum, examBox] = await Promise.all([
    getTranslations("Player"),
    getCurriculum(courseId, userId),
    getFinalExamBox(courseId, userId),
  ]);

  return (
    <div className="mx-auto grid max-w-7xl gap-0 lg:grid-cols-[20rem_1fr]">
      <aside className="hidden border-r border-line bg-surface lg:block lg:min-h-[calc(100vh-4rem)]">
        <div className="border-b border-line p-4">
          <Link
            href={`/courses/${courseSlug}`}
            className="text-sm text-navy-600 hover:underline"
          >
            ← {t("backToCourse")}
          </Link>
        </div>
        <PlayerSidebar
          courseId={courseId}
          curriculum={curriculum}
          activeLessonId={activeLessonId}
          examBox={examBox}
          examActive={activeLessonId === "exam"}
        />
      </aside>
      <main className="px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

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
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[20rem_1fr]">
      {/* Floating curriculum card: sticks below the 4rem site header and
          scrolls internally, matching the rounded compartments on the right. */}
      <aside className="hidden lg:block">
        <div className="sticky top-[5.5rem] max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-line bg-surface shadow-sm">
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
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}

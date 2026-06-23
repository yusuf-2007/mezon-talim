import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { getCurriculum } from "@/lib/learning/curriculum";

/** Entry point for a course: jump to the resume lesson (B3) or the first one. */
export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const user = await requireUser();
  const course = await coursesRepository.findById(courseId);
  if (!course) notFound();

  const curriculum = await getCurriculum(courseId, user.id);
  if (curriculum.resumeLessonId) {
    return redirectLocalized(`/learn/${courseId}/${curriculum.resumeLessonId}`);
  }
  // Nothing accessible yet → back to the course page to enroll.
  return redirectLocalized(`/courses/${course.slug}`);
}

import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { getRunnerState } from "@/lib/assessments/service";
import { coursesRepository } from "@/lib/db/repositories/courses";
import { pickLocale } from "@/lib/i18n/localized";
import { ExamRunner } from "@/components/exam/exam-runner";
import { ExamClock } from "@/components/exam/exam-clock";
import { FocusBar, initialsOf } from "@/components/learn/flow-ui";
import type { Locale } from "@/lib/i18n/routing";

export default async function ExamRunnerPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const user = await requireUser();

  let state;
  try {
    state = await getRunnerState(attemptId, user.id);
  } catch {
    notFound();
  }
  // Already submitted → go to the result.
  if (state.submitted) {
    return redirectLocalized(`/exam/attempt/${attemptId}/result`);
  }

  const [course, tPlayer, locale] = await Promise.all([
    coursesRepository.findById(state.assessment.courseId),
    getTranslations("Player"),
    getLocale(),
  ]);
  if (!course) notFound();

  return (
    <>
      <FocusBar
        courseHref={`/courses/${course.slug}`}
        courseTitle={pickLocale(course.title, locale as Locale)}
        backLabel={tPlayer("backToCourse")}
        initials={initialsOf(user.fullName ?? user.email ?? user.phone)}
        right={<ExamClock endsAt={state.endsAt} />}
      />
      <ExamRunner
        attemptId={attemptId}
        questions={state.questions}
        initialAnswers={state.answers}
      />
    </>
  );
}

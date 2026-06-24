import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { redirectLocalized } from "@/lib/i18n/redirect";
import { getRunnerState } from "@/lib/assessments/service";
import { ExamRunner } from "@/components/exam/exam-runner";

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

  return (
    <ExamRunner
      attemptId={attemptId}
      questions={state.questions}
      initialAnswers={state.answers}
      endsAt={state.endsAt}
    />
  );
}

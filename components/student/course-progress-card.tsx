import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Enrolled-course card with a progress bar and a resume button. The resume link
 * goes to /learn/[courseId], which redirects to the first incomplete lesson.
 *
 * `headingLevel` exists because this card appears at two different depths: under
 * a section heading on the dashboard (h3, the default) and directly under the
 * page title on /dashboard/courses (h2). Hard-coding h3 skipped a level there.
 */
export function CourseProgressCard({
  courseId,
  title,
  pct,
  t,
  headingLevel = 3,
}: {
  courseId: string;
  title: string;
  pct: number;
  t: { progress: string; resume: string; completed: string };
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <li className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-sm">
      <Heading className="font-heading text-lg font-semibold text-navy-800">
        {title}
      </Heading>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-navy-100">
        <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500 tabular-nums">{t.progress}</p>
      <Button render={<Link href={`/learn/${courseId}`} />} className="mt-4" size="sm">
        {pct >= 100 ? t.completed : t.resume}
      </Button>
    </li>
  );
}

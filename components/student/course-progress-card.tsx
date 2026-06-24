import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Enrolled-course card with a progress bar and a resume button. The resume link
 * goes to /learn/[courseId], which redirects to the first incomplete lesson.
 */
export function CourseProgressCard({
  courseId,
  title,
  pct,
  t,
}: {
  courseId: string;
  title: string;
  pct: number;
  t: { progress: string; resume: string; completed: string };
}) {
  return (
    <li className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-sm">
      <h3 className="font-heading text-lg font-semibold text-navy-800">{title}</h3>
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

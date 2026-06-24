import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";

/** Certificate card with download (PDF) + verify (public page) actions. */
export function CertCard({
  code,
  title,
  issued,
  labels,
}: {
  code: string;
  title: string;
  issued: string;
  labels: { download: string; verify: string };
}) {
  return (
    <li className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading text-base font-semibold text-navy-800">{title}</h3>
        <span className="text-2xl" aria-hidden>
          🎓
        </span>
      </div>
      <p className="mt-2 font-mono text-xs text-slate-500">{code}</p>
      <p className="text-xs text-slate-500">{issued}</p>
      <div className="mt-4 flex gap-2">
        <Button
          render={
            <a
              href={`/api/certificates/${code}/pdf`}
              target="_blank"
              rel="noreferrer"
            />
          }
          size="sm"
          variant="outline"
        >
          {labels.download}
        </Button>
        <Button render={<Link href={`/verify/${code}`} />} size="sm" variant="ghost">
          {labels.verify}
        </Button>
      </div>
    </li>
  );
}

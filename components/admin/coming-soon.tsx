import { Construction } from "lucide-react";
/** Placeholder for admin sections whose page is scheduled in a later chunk. */
export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-navy-800">{title}</h1>
      <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
        <Construction className="mx-auto size-10 text-slate-400" aria-hidden />
        <p className="mt-3 text-slate-500">{note}</p>
      </div>
    </div>
  );
}

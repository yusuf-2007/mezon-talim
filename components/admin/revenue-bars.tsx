import { formatTiyin } from "@/lib/payments";

/**
 * Minimal CSS bar chart of daily paid revenue — no chart library. Bars scale to
 * the max day; empty days are omitted by the query, so a sparse series is fine.
 */
export function RevenueBars({
  data,
  locale,
  emptyLabel,
}: {
  data: { day: string; totalTiyin: number; count: number }[];
  locale: "uz" | "ru";
  emptyLabel: string;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">{emptyLabel}</p>;
  }
  const max = Math.max(...data.map((d) => d.totalTiyin), 1);

  return (
    <div className="flex h-44 items-end gap-1 overflow-x-auto pb-2">
      {data.map((d) => (
        <div key={d.day} className="group flex min-w-[10px] flex-1 flex-col items-center">
          <div className="relative flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-navy-600 transition-colors group-hover:bg-gold-500"
              style={{ height: `${Math.max(2, (d.totalTiyin / max) * 100)}%` }}
              title={`${d.day}: ${formatTiyin(d.totalTiyin, locale)} (${d.count})`}
            />
          </div>
          <span className="mt-1 hidden text-[9px] text-slate-500 tabular-nums sm:block">
            {d.day.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

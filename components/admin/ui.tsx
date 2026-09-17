import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The card and table vocabulary every admin view is built from.
 *
 * The handoff specifies one card, one table, one pill, one status dot, one
 * banner — fourteen views' worth of surface with five shapes. Keeping them here
 * rather than in each page is what stops the fourteenth view from inventing a
 * sixth.
 */

export function Card({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "overflow-hidden rounded-2xl border border-lp-line bg-surface shadow-[0_2px_10px_rgba(2,58,105,.05)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Card header: gold eyebrow, serif title, and whatever sits on the right. */
export function CardHead({
  eyebrow,
  title,
  right,
  className,
}: {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-3 border-b border-lp-line-soft px-6 py-5",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[.74rem] font-bold uppercase tracking-[.14em] text-lp-gold-deep">
            {eyebrow}
          </p>
        )}
        <h2 className="font-lp-heading text-[1.2rem] font-semibold text-lp-navy">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-10 text-center text-[.88rem] text-lp-muted">{children}</p>;
}

export function GhostLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1.5 text-[.84rem] font-bold text-lp-navy-mid hover:underline"
    >
      {children}
      <ArrowRight className="size-3.5" strokeWidth={2.2} />
    </Link>
  );
}

const PILL_TONE = {
  navy: "bg-lp-tint text-lp-navy",
  gold: "bg-lp-gold-tint text-lp-gold-ink",
  green: "bg-lp-success-tint text-lp-success",
  red: "bg-lp-danger-tint text-lp-danger",
  grey: "bg-lp-line-soft text-lp-muted",
} as const;

export type PillTone = keyof typeof PILL_TONE;

export function Pill({
  tone = "grey",
  children,
}: {
  tone?: PillTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[.74rem] font-bold",
        PILL_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

const DOT_TONE = {
  green: { dot: "bg-lp-success-dot", text: "text-lp-success" },
  amber: { dot: "bg-lp-gold", text: "text-lp-gold-ink" },
  red: { dot: "bg-lp-danger", text: "text-lp-danger" },
  navy: { dot: "bg-lp-navy-mid", text: "text-lp-navy" },
  grey: { dot: "bg-lp-line-strong", text: "text-lp-muted" },
} as const;

export type DotTone = keyof typeof DOT_TONE;

/** Status as a dot plus a word — the table's whole status language. */
export function StatusDot({
  tone,
  children,
}: {
  tone: DotTone;
  children: React.ReactNode;
}) {
  const s = DOT_TONE[tone];
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-[.8rem] font-bold", s.text)}>
      <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", s.dot)} />
      {children}
    </span>
  );
}

/**
 * The one table.
 *
 * Scrolls horizontally rather than wrapping, and a column marked `hide` drops
 * out below `xl` — the handoff's `.hidem`. Cells are nodes, so a row can carry
 * a pill or a control without a second table component.
 */
export function Table({
  head,
  rows,
  empty,
}: {
  head: { label: string; hide?: boolean; align?: "right" }[];
  rows: React.ReactNode[][];
  empty?: React.ReactNode;
}) {
  if (rows.length === 0 && empty) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className={cn(
                  "whitespace-nowrap border-b border-lp-line bg-lp-row-hover px-4 py-3 text-left text-[.74rem] font-bold uppercase tracking-[.1em] text-lp-muted",
                  h.hide && "hidden xl:table-cell",
                  h.align === "right" && "text-right",
                )}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="transition-colors hover:bg-lp-row-hover">
              {cells.map((c, j) => (
                <td
                  key={j}
                  className={cn(
                    "border-b border-lp-line-soft px-4 py-3.5 text-[.88rem] text-lp-ink",
                    head[j]?.hide && "hidden xl:table-cell",
                    head[j]?.align === "right" && "text-right tabular-nums",
                  )}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const BANNER_TONE = {
  warn: "border-lp-gold-band bg-lp-gold-wash text-lp-gold-ink",
  danger: "border-lp-danger-line bg-lp-danger-tint text-lp-danger",
  info: "border-lp-line bg-lp-tint text-lp-navy",
} as const;

const BANNER_DOT = {
  warn: "bg-lp-gold",
  danger: "bg-lp-danger",
  info: "bg-lp-navy-mid",
} as const;

export function Banner({
  tone,
  children,
  className,
}: {
  tone: keyof typeof BANNER_TONE;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border px-4 py-3", BANNER_TONE[tone], className)}>
      <p className="flex items-start gap-2.5 text-[.84rem] leading-relaxed">
        <span
          aria-hidden
          className={cn("mt-[.45rem] size-2 shrink-0 rounded-full", BANNER_DOT[tone])}
        />
        <span>{children}</span>
      </p>
    </div>
  );
}

/**
 * Filter chips that navigate rather than hold state.
 *
 * Every admin filter is a URL search param, as the users table already does, so
 * a filtered view can be linked, bookmarked and reloaded. That rules out client
 * state for all of them.
 */
export function FilterChips({
  options,
  active,
  hrefFor,
}: {
  options: { value: string | null; label: string; count?: number }[];
  active: string | null;
  hrefFor: (value: string | null) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === active;
        return (
          <Link
            key={o.value ?? "all"}
            href={hrefFor(o.value)}
            aria-current={on ? "true" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[.84rem] font-semibold transition-colors",
              on
                ? "bg-lp-navy text-white"
                : "border border-lp-line bg-surface text-lp-slate hover:bg-lp-wash",
            )}
          >
            {o.label}
            {o.count != null && (
              <span className={cn("tabular-nums", on ? "text-white/70" : "text-lp-muted")}>
                {o.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** A horizontal proportion bar — progress, pass rates, funnel steps. */
export function Bar({
  value,
  max,
  tone = "navy",
  className,
}: {
  value: number;
  max: number;
  tone?: "navy" | "gold" | "green" | "red";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const fill = {
    navy: "bg-lp-navy",
    gold: "bg-lp-gold",
    green: "bg-lp-success-dot",
    red: "bg-lp-danger",
  }[tone];
  return (
    <span
      className={cn("block h-1.5 overflow-hidden rounded-full bg-lp-line-soft", className)}
    >
      <span className={cn("block h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * The KPI strip: one card divided into cells by hairlines, not four cards.
 *
 * Four separate cards read as four unrelated facts. One card with dividers
 * reads as one measurement taken four ways, which is what these always are.
 * Collapses to 2×2 before it collapses to a column.
 */
export function KpiStrip({
  cells,
}: {
  cells: { label: string; value: string; sub?: string; tone?: "amber" | "red" | "green" }[];
}) {
  const toneClass = {
    amber: "text-lp-gold-ink",
    red: "text-lp-danger",
    green: "text-lp-success",
  };
  return (
    <Card>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        {cells.map((c) => (
          <div
            key={c.label}
            className="border-lp-line-soft px-6 py-5 sm:border-l sm:first:border-l-0 sm:[&:nth-child(3)]:border-l-0 xl:border-l xl:first:border-l-0 xl:[&:nth-child(3)]:border-l"
          >
            <p className="mb-1.5 text-[.74rem] font-bold uppercase tracking-[.1em] text-lp-muted">
              {c.label}
            </p>
            <p
              className={cn(
                "font-lp-heading text-[1.9rem] font-semibold leading-none tabular-nums",
                c.tone ? toneClass[c.tone] : "text-lp-navy",
              )}
            >
              {c.value}
            </p>
            {c.sub && <p className="mt-1.5 text-[.8rem] text-lp-muted">{c.sub}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/** A search box that submits as a GET form, keeping the filter in the URL. */
export function SearchForm({
  action,
  defaultValue,
  placeholder,
  hidden,
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
  /** Other active filters, so searching does not silently drop them. */
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} className="flex min-w-[14rem] flex-1 gap-2 sm:max-w-xs">
      {Object.entries(hidden ?? {}).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-10 w-full rounded-[10px] border-[1.5px] border-lp-line bg-surface px-3 text-[.9rem] text-lp-ink outline-none transition-colors placeholder:text-lp-muted-light focus:border-lp-navy focus:ring-[3px] focus:ring-lp-gold/35"
      />
    </form>
  );
}

/** The bar every list card carries above its table: filters left, tools right. */
export function CardToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-lp-line-soft px-6 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

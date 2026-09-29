import { Check, ChevronDown, Play } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import type { FlowLessonState } from "@/lib/learning/flow";

/**
 * The small vocabulary every learning-flow screen shares: the state circle,
 * the row of lesson ticks, the eyebrow, and the dark focus bar. Presentational
 * only — no data access — so both server pages and the client exam runner can
 * render them.
 */

export function Eyebrow({
  children,
  className,
  tone = "gold",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "gold" | "muted" | "light";
}) {
  return (
    <p
      className={cn(
        "text-[.74rem] font-bold uppercase tracking-[.14em]",
        tone === "gold" && "text-lp-gold-deep",
        tone === "muted" && "text-lp-muted",
        tone === "light" && "text-lp-gold-light",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Done = navy tick, current = gold play, locked = empty ring. */
export function StateDot({
  state,
  size = "md",
}: {
  state: FlowLessonState;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "size-6" : "size-7";
  const icon = size === "sm" ? "size-3" : "size-3.5";
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-[1.5px]",
        box,
        state === "done" && "border-lp-navy bg-lp-navy text-white",
        state === "current" && "border-lp-gold bg-lp-gold text-lp-navy-deep",
        state === "preview" && "border-lp-navy-mid bg-white text-lp-navy-mid",
        state === "locked" && "border-lp-line-strong bg-white",
      )}
    >
      {state === "done" && <Check className={icon} strokeWidth={3} />}
      {(state === "current" || state === "preview") && (
        <Play className={cn(icon, "fill-current")} strokeWidth={0} />
      )}
    </span>
  );
}

/** One bar per lesson: navy when done, gold for the current one, empty otherwise. */
export function LessonTicks({
  states,
  height = "md",
  className,
}: {
  states: FlowLessonState[];
  height?: "sm" | "md";
  className?: string;
}) {
  return (
    <span className={cn("flex gap-1", className)} aria-hidden>
      {states.map((s, i) => (
        <span
          key={i}
          className={cn(
            "flex-1 rounded-[2px] border-[1.5px]",
            height === "sm" ? "h-1.5" : "h-2",
            s === "done" && "border-lp-navy bg-lp-navy",
            s === "current" && "border-lp-gold bg-lp-gold",
            (s === "locked" || s === "preview") && "border-lp-line-strong bg-transparent",
          )}
        />
      ))}
    </span>
  );
}

/**
 * The dark bar that replaces the site header inside the course: the way back
 * to the course page, the course's name, and whatever the screen needs on the
 * right — lesson progress, or the exam clock.
 */
export function FocusBar({
  courseHref,
  courseTitle,
  backLabel,
  initials,
  progress,
  right,
}: {
  courseHref: string;
  courseTitle: string;
  backLabel: string;
  initials: string;
  progress?: { done: number; total: number } | null;
  right?: React.ReactNode;
}) {
  const pct = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between gap-5 bg-lp-navy px-5 sm:px-7">
      <div className="flex min-w-0 items-center gap-[18px]">
        <Link
          href={courseHref}
          className="inline-flex items-center gap-[7px] whitespace-nowrap text-[.86rem] font-semibold text-lp-on-navy transition-colors hover:text-white"
        >
          <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {backLabel}
        </Link>
        <span aria-hidden className="hidden h-5 w-px bg-white/[.18] md:block" />
        <span className="hidden truncate font-lp-heading text-[1.05rem] font-semibold text-white md:block">
          {courseTitle}
        </span>
      </div>
      <div className="flex items-center gap-4">
        {right}
        {progress && (
          <span className="hidden items-center gap-2.5 md:flex">
            <span className="block h-1.5 w-[120px] overflow-hidden rounded-[3px] bg-white/[.14]">
              <span className="block h-full bg-lp-gold" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-[.8rem] text-lp-on-navy tabular-nums">
              {progress.done} / {progress.total}
            </span>
          </span>
        )}
        <Link
          href="/dashboard"
          aria-label={initials}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-lp-gold text-[.74rem] font-extrabold text-lp-navy-deep"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}

/**
 * One module of a curriculum list, folded behind its header. Every place that
 * lists modules with their lessons (the course page path, the rail beside the
 * video) goes through this, so they share one default: the first module open,
 * the rest collapsed. Native <details>, so it needs no client JS and keeps
 * whatever the student toggled across server refreshes.
 */
export function ModuleAccordion({
  index,
  summary,
  summaryClassName,
  children,
}: {
  /** 0-based position of the module; only the first starts open. */
  index: number;
  summary: React.ReactNode;
  summaryClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={index === 0} className="group/module">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-3 transition-colors [&::-webkit-details-marker]:hidden",
          summaryClassName,
        )}
      >
        {summary}
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-lp-muted transition-transform group-open/module:rotate-180"
        />
      </summary>
      {children}
    </details>
  );
}

/** Up to two letters from a name. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return parts
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

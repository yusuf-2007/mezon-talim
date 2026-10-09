import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { clock } from "@/lib/learning/flow";
import { cn } from "@/lib/utils";
import { MarkPartOpened } from "./mark-part-opened";

export type LessonPart = {
  id: string;
  /** "1-qism", or the teacher's title for the part. */
  label: string;
  durationSeconds: number | null;
};

/**
 * Parts of a long lesson, under the video: one chip per part (the one on
 * screen filled, opened ones ticked) and "Next part" until the last one.
 *
 * Parts are plain links (`?part=n`), so each is its own page load with its own
 * signed video URL, and the browser's back button walks the parts.
 */
export async function LessonParts({
  href,
  parts,
  currentIndex,
  openedIds,
  lessonId,
  trackOpen,
}: {
  /** The lesson's URL, without the query. */
  href: string;
  parts: LessonPart[];
  currentIndex: number;
  openedIds: Set<string>;
  lessonId: string;
  /** Record the part as opened (enrolled students only). */
  trackOpen: boolean;
}) {
  const t = await getTranslations("Player");
  const current = parts[currentIndex];
  const next = parts[currentIndex + 1];
  const partHref = (i: number) => `${href}?part=${i + 1}`;

  return (
    <nav
      aria-label={t("partsNav")}
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
      data-testid="lesson-parts"
    >
      {trackOpen && <MarkPartOpened lessonId={lessonId} videoId={current.id} />}
      <ol className="flex flex-wrap gap-2">
        {parts.map((p, i) => {
          const active = i === currentIndex;
          const opened = openedIds.has(p.id);
          return (
            <li key={p.id}>
              <Link
                href={partHref(i)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border-[1.5px] px-3.5 py-[7px] text-[.85rem] font-bold transition-colors",
                  active
                    ? "border-lp-navy bg-lp-navy text-white"
                    : "border-lp-line bg-white text-lp-navy hover:bg-lp-wash",
                )}
              >
                {opened && !active && (
                  <Check className="size-3.5 text-lp-success" strokeWidth={3} aria-hidden />
                )}
                <span>{p.label}</span>
                {p.durationSeconds ? (
                  <span
                    className={cn(
                      "text-[.8rem] font-semibold tabular-nums",
                      active ? "text-lp-on-navy" : "text-lp-muted",
                    )}
                  >
                    {clock(p.durationSeconds)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
      {next && (
        <Link
          href={partHref(currentIndex + 1)}
          className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-lp-gold bg-lp-gold-wash px-3.5 py-[9px] text-[.86rem] font-bold text-lp-navy-deep transition-colors hover:bg-lp-gold-tint"
        >
          {t("nextPart")}
        </Link>
      )}
    </nav>
  );
}

"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { pickLocale } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils";
import type { Curriculum } from "@/lib/learning/curriculum";

/**
 * Modules → lessons accordion for the course-detail page. Accessible lessons
 * (preview, or enrolled + unlocked) link into the player; locked ones show a
 * lock icon and are inert.
 */
export function CurriculumAccordion({
  courseId,
  curriculum,
}: {
  courseId: string;
  curriculum: Curriculum;
}) {
  const locale = useLocale();
  const t = useTranslations("Course");
  const [open, setOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(curriculum.modules.map((m) => [m.id, true])),
  );

  if (curriculum.modules.length === 0) {
    return <p className="text-slate-500">{t("noLessons")}</p>;
  }

  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {curriculum.modules.map((m, i) => (
        <div key={m.id}>
          <button
            type="button"
            onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
          >
            <span className="font-heading font-semibold text-navy-800">
              <span className="mr-2 tabular-nums text-slate-500">{i + 1}.</span>
              {pickLocale(m.title, locale)}
            </span>
            <span className="text-sm text-slate-500">
              {t("nLessons", { count: m.lessons.length })}
            </span>
          </button>

          {open[m.id] && (
            <ul className="border-t border-line">
              {m.lessons.map((lesson) => {
                const label = pickLocale(lesson.title, locale);
                const row = (
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-xs",
                        lesson.completed
                          ? "bg-success text-white"
                          : lesson.accessible
                            ? "border border-navy-600 text-navy-600"
                            : "border border-line text-slate-500",
                      )}
                      aria-hidden
                    >
                      {lesson.completed ? "✓" : lesson.accessible ? "▷" : "🔒"}
                    </span>
                    <span
                      className={cn(
                        "text-sm",
                        lesson.accessible ? "text-ink" : "text-slate-500",
                      )}
                    >
                      {label}
                    </span>
                    {lesson.isPreview && (
                      <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-navy-800">
                        {t("preview")}
                      </span>
                    )}
                  </div>
                );
                return (
                  <li key={lesson.id} className="px-5 py-2.5">
                    {lesson.accessible ? (
                      <Link
                        href={`/learn/${courseId}/${lesson.id}`}
                        className="block rounded-md transition-colors hover:text-navy-800"
                      >
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

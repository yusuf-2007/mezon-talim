"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type GlossaryTerm = {
  id: string;
  term: string;
  definition: string;
  /** The course this term belongs to, or null when it applies everywhere. */
  scope: string | null;
};

/**
 * Search box, letter index, and the term list.
 *
 * The letter index only offers letters that actually have a term behind them;
 * a full A–Z where two thirds of the keys do nothing looks like a broken
 * control rather than a complete alphabet.
 */
export function GlossaryBrowser({ terms }: { terms: GlossaryTerm[] }) {
  const t = useTranslations("Student");
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState<string | null>(null);

  const letters = useMemo(
    () => [...new Set(terms.map((x) => x.term[0]?.toUpperCase()).filter(Boolean))].sort(),
    [terms],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return terms.filter((x) => {
      if (letter && x.term[0]?.toUpperCase() !== letter) return false;
      if (!q) return true;
      return (
        x.term.toLowerCase().includes(q) || x.definition.toLowerCase().includes(q)
      );
    });
  }, [terms, query, letter]);

  if (terms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-lp-line-strong bg-surface p-12 text-center text-[.92rem] text-lp-slate">
        {t("glossaryEmpty")}
      </div>
    );
  }

  return (
    <>
      <div className="relative mb-5">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-lp-muted"
          strokeWidth={2}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("glossarySearch")}
          aria-label={t("glossarySearch")}
          className="min-h-11 w-full rounded-[10px] border-[1.5px] border-lp-line bg-surface py-3 pl-10 pr-4 text-[.92rem] text-lp-ink outline-none transition-colors placeholder:text-lp-muted-light focus:border-lp-navy focus:ring-[3px] focus:ring-lp-gold/35"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setLetter(null)}
          aria-pressed={letter === null}
          className={cn(
            "grid h-8 min-w-11 place-items-center rounded-[6px] px-2.5 text-[.8rem] font-bold transition-colors",
            letter === null ? "bg-lp-navy text-white" : "text-lp-slate hover:bg-lp-wash",
          )}
        >
          {t("glossaryAll")} · {terms.length}
        </button>
        {letters.map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => setLetter(letter === ch ? null : ch)}
            aria-pressed={letter === ch}
            className={cn(
              "grid size-8 place-items-center rounded-[6px] text-[.8rem] font-bold transition-colors",
              letter === ch ? "bg-lp-navy text-white" : "text-lp-slate hover:bg-lp-wash",
            )}
          >
            {ch}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-lp-line-strong bg-surface p-12 text-center text-[.92rem] text-lp-slate">
          {t("glossaryNoMatch", { q: query })}
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-lp-line bg-surface shadow-[0_2px_10px_rgba(2,58,105,.05)]">
          {shown.map((x, i) => (
            <div
              key={x.id}
              className={cn(
                "grid items-start gap-6 px-7 py-5 sm:grid-cols-[200px_1fr_auto]",
                i < shown.length - 1 && "border-b border-lp-line-soft",
              )}
            >
              <p className="font-lp-heading text-[1.2rem] font-semibold leading-tight text-lp-navy">
                {x.term}
              </p>
              <p className="max-w-[64ch] text-[.92rem] leading-relaxed text-lp-slate">
                {x.definition}
              </p>
              <span className="justify-self-start whitespace-nowrap rounded-full bg-lp-tint px-2.5 py-0.5 text-[.7rem] font-bold text-lp-navy sm:justify-self-end">
                {x.scope ?? t("scopeGeneral")}
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

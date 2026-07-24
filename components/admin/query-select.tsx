"use client";

import { useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/lib/i18n/navigation";

/**
 * A select that applies itself on change by rewriting one URL search param
 * (optionally clearing dependent ones — e.g. changing the course resets the
 * lesson). Server components re-render with the new params; no submit button.
 */
export function QuerySelect({
  param,
  value,
  options,
  placeholder,
  clears = [],
}: {
  param: string;
  value: string;
  options: { id: string; label: string }[];
  placeholder: string;
  clears?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  function onChange(next: string) {
    const query: Record<string, string> = {};
    searchParams.forEach((v, k) => {
      query[k] = v;
    });
    if (next) query[param] = next;
    else delete query[param];
    for (const c of clears) delete query[c];
    start(() => router.replace({ pathname, query }));
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={pending}
      aria-label={placeholder}
      className="max-w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink disabled:opacity-50"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

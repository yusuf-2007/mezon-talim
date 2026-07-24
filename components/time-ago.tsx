"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "next-intl";

/** "5 minutes ago" via Intl — no per-unit i18n keys needed. */
function relative(iso: string, locale: string): string {
  const diffSec = (Date.parse(iso) - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    for (const [unit, sec] of units) {
      if (Math.abs(diffSec) >= sec) return rtf.format(Math.round(diffSec / sec), unit);
    }
    return rtf.format(Math.round(diffSec), "second");
  } catch {
    return new Date(iso).toLocaleDateString(locale);
  }
}

/** Re-evaluate every minute so displayed relative times stay current. */
function subscribe(onStoreChange: () => void) {
  const timer = setInterval(onStoreChange, 60_000);
  return () => clearInterval(timer);
}

/**
 * Relative timestamp that renders empty on the server and fills in on the
 * client (useSyncExternalStore's server snapshot). Rendering it during SSR
 * guaranteed hydration mismatches — Node's ICU lacks the uz locale (giving
 * "-12 s" vs the browser's "12 soniya oldin"), and the clock ticks between
 * render and hydration. Caught by Sentry on /dashboard/messages.
 */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const locale = useLocale();
  const text = useSyncExternalStore(
    subscribe,
    () => relative(iso, locale),
    () => "",
  );
  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}

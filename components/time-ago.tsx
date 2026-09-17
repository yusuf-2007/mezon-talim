"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

/** Largest-first, so the first unit that fits is the one we name. */
const UNITS = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
] as const;

type Unit = (typeof UNITS)[number][0] | "second";

/** Re-evaluate every minute so displayed relative times stay current. */
function subscribe(onStoreChange: () => void) {
  const timer = setInterval(onStoreChange, 60_000);
  return () => clearInterval(timer);
}

/**
 * `"day|1"`, not an object: useSyncExternalStore compares snapshots with
 * Object.is, so a fresh object every call is an infinite render loop. Seconds
 * are bucketed to ten so repeated calls inside one render agree.
 */
function snapshot(iso: string): string {
  const agoSec = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(agoSec)) return "";
  for (const [unit, sec] of UNITS) {
    if (agoSec >= sec) return `${unit}|${Math.round(agoSec / sec)}`;
  }
  return `second|${Math.max(0, Math.floor(agoSec / 10) * 10)}`;
}

/**
 * Relative timestamp ("5 daqiqa oldin"), phrased from our own message
 * catalogue rather than `Intl.RelativeTimeFormat`.
 *
 * Chrome resolves the `uz` locale but carries no Uzbek relative-time data, so
 * ICU silently answers in English — an Uzbek student on the messages page saw
 * "yesterday". Our own keys render the same in every browser.
 *
 * Renders empty on the server and fills in on the client
 * (useSyncExternalStore's server snapshot): the clock ticks between render and
 * hydration, which guaranteed a mismatch. Caught by Sentry on
 * /dashboard/messages.
 */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const t = useTranslations("TimeAgo");
  const snap = useSyncExternalStore(
    subscribe,
    () => snapshot(iso),
    () => "",
  );

  let text = "";
  if (snap) {
    const [unit, raw] = snap.split("|") as [Unit, string];
    const count = Number(raw);
    text = unit === "second" && count < 10 ? t("now") : t(unit, { count });
  }

  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}

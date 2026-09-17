import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The single timezone the product reasons about.
 *
 * Every student is in Uzbekistan and the server runs in UTC, so "today" has to
 * be named explicitly or a lesson finished at 1am Tashkent lands on yesterday's
 * bar in the week strip.
 */
export const APP_TIME_ZONE = "Asia/Tashkent";

/** `YYYY-MM-DD` for a moment, as that date reads in Uzbekistan. */
export function appDayKey(d: Date): string {
  // en-CA formats as YYYY-MM-DD, which is what Postgres to_char gives us.
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(d);
}

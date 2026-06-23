import type { LocalizedText } from "@/lib/db/schema";

/**
 * Pick the best string from a LocalizedText blob for the active locale, falling
 * back to Uzbek (the always-present launch locale).
 */
export function pickLocale(
  text: LocalizedText | null | undefined,
  locale: string,
): string {
  if (!text) return "";
  if (locale === "ru" && text.ru) return text.ru;
  return text.uz ?? text.ru ?? "";
}

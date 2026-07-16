import { defineRouting } from "next-intl/routing";

/**
 * App locales. Uzbek (Latin) is the launch default; Russian is the fast-follow;
 * English is an added UI locale (course content falls back to Uzbek until it is
 * authored in English). No Arabic (per CLAUDE.md non-negotiables / design-system).
 */
export const routing = defineRouting({
  locales: ["uz", "ru", "en"],
  defaultLocale: "uz",
});

export type Locale = (typeof routing.locales)[number];

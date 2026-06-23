import { defineRouting } from "next-intl/routing";

/**
 * App locales. Uzbek (Latin) is the launch default; Russian is the fast-follow.
 * No Arabic (per CLAUDE.md non-negotiables / design-system).
 */
export const routing = defineRouting({
  locales: ["uz", "ru"],
  defaultLocale: "uz",
});

export type Locale = (typeof routing.locales)[number];

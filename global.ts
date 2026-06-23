import type { routing } from "@/lib/i18n/routing";
import type messages from "./messages/uz.json";

// Type-safe locales + message keys across the app (next-intl v4).
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}

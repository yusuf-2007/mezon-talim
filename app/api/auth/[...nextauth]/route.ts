import { handlers } from "@/lib/auth/config";

// Auth.js HTTP endpoints (sign-in/out, callbacks, CSRF). Outside the [locale]
// segment and excluded from the i18n proxy matcher.
export const { GET, POST } = handlers;

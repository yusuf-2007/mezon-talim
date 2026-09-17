import { redirectLocalized } from "@/lib/i18n/redirect";

/**
 * Profile folded into settings: everything here is "my account", and splitting
 * it across two pages meant guessing which one held your phone number. The
 * route stays so existing links and bookmarks keep working.
 */
export default async function StudentProfilePage() {
  return redirectLocalized("/dashboard/settings#profile");
}

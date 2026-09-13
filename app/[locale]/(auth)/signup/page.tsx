import { redirectLocalized } from "@/lib/i18n/redirect";

/**
 * Sign-up no longer has a page of its own: entering a phone number that has no
 * account *is* the sign-up. The route stays so existing links, bookmarks and
 * the site header keep working.
 */
export default async function SignupPage() {
  return redirectLocalized("/login");
}

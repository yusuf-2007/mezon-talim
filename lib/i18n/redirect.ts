import "server-only";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

/**
 * Redirect to a locale-prefixed path, preserving the active request locale.
 * Uses Next's redirect (typed `never`) so callers narrow correctly after it.
 */
export async function redirectLocalized(path: string): Promise<never> {
  const locale = await getLocale();
  const suffix = path.startsWith("/") ? path : `/${path}`;
  redirect(`/${locale}${suffix}`);
}

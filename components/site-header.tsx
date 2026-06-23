import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { landingPathForRole } from "@/lib/auth/landing";
import { Button } from "@/components/ui/button";
import { BrandWordmark } from "@/components/brand-wordmark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/auth/logout-button";

/**
 * Light top bar that sits above the navy hero. Shows auth actions based on the
 * current session. Catalog/about/faq targets are still placeholders.
 */
export async function SiteHeader() {
  const [t, user] = await Promise.all([
    getTranslations("Nav"),
    getCurrentUser(),
  ]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center">
          <BrandWordmark />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-500 md:flex">
          <Link href="/catalog" className="transition-colors hover:text-navy-800">
            {t("courses")}
          </Link>
          <Link href="/" className="transition-colors hover:text-navy-800">
            {t("about")}
          </Link>
          <Link href="/" className="transition-colors hover:text-navy-800">
            {t("faq")}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {user ? (
            <div className="flex items-center gap-2">
              <Button
                render={<Link href={landingPathForRole(user.role)} />}
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
              >
                {user.fullName ?? user.email ?? user.phone}
              </Button>
              <LogoutButton />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                render={<Link href="/login" />}
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
              >
                {t("login")}
              </Button>
              <Button
                render={<Link href="/signup" />}
                size="sm"
                className="hidden sm:inline-flex"
              >
                {t("signup")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

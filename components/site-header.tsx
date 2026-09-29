import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { landingPathForRole } from "@/lib/auth/landing";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { initialsOf } from "@/components/learn/flow-ui";
import { HeaderNav, InlineLanguage } from "@/components/site-header-parts";

/**
 * The public top bar: logo, the three public sections, and on the right the
 * language, notifications and a way into your own area.
 *
 * Signed in, the right side is an avatar and "Kabinet" rather than a name and a
 * log-out button: the cabinet is where the account lives, and log out sits in
 * its rail with everything else about the session.
 */
export async function SiteHeader() {
  const [t, user] = await Promise.all([getTranslations("Nav"), getCurrentUser()]);

  return (
    <header className="sticky top-0 z-30 border-b border-lp-line bg-white">
      <div className="flex items-center justify-between gap-6 px-5 py-3.5 sm:px-12">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Mezon Ta'lim">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img
            src="/brand/mezon-logo-horizontal.png"
            alt="Mezon Ta'lim"
            width={152}
            height={30}
            className="block h-[30px] w-auto"
          />
        </Link>

        <HeaderNav
          items={[
            { href: "/catalog", label: t("courses"), match: ["/courses"] },
            { href: "/about", label: t("about") },
            { href: "/faq", label: t("faq") },
          ]}
        />

        <div className="flex items-center gap-[18px]">
          <span className="hidden sm:block">
            <InlineLanguage />
          </span>
          {user ? (
            <>
              <NotificationBell userId={user.id} role={user.role} />
              <Link
                href={landingPathForRole(user.role)}
                className="flex items-center gap-[9px] text-[.88rem] font-bold text-lp-navy"
              >
                <span className="grid size-8 place-items-center rounded-full bg-lp-gold text-[.74rem] font-extrabold text-lp-navy-deep">
                  {initialsOf(user.fullName ?? user.email ?? user.phone)}
                </span>
                <span className="hidden sm:inline">{t("cabinet")}</span>
              </Link>
            </>
          ) : (
            <span className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-[9px] border-[1.5px] border-lp-line px-3.5 py-2 text-[.86rem] font-bold text-lp-navy transition-colors hover:bg-lp-wash"
              >
                {t("login")}
              </Link>
              <Link
                href="/signup"
                className="hidden rounded-[9px] bg-lp-gold px-3.5 py-2 text-[.86rem] font-bold text-lp-navy-deep shadow-[0_4px_14px_rgba(248,184,1,.28)] sm:inline-block"
              >
                {t("signup")}
              </Link>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

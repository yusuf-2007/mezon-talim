import { getLocale, getTranslations } from "next-intl/server";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { APP_TIME_ZONE } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/routing";

/**
 * The header every dashboard view shares: a gold eyebrow naming the section, a
 * serif title saying what this particular page is, then today's date and the
 * bell. Consistent across views so the eye learns where the title lives.
 */
export async function PageHeader({
  eyebrow,
  title,
  userId,
  role,
}: {
  eyebrow: string;
  title: string;
  userId: string;
  role: string;
}) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Student");
  const dateLocale = locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "uz-UZ";
  // Named timezone: the server runs in UTC, so "today" is wrong in Tashkent
  // for the first five hours of every day.
  const today = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  });

  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="mb-2 text-[.74rem] font-bold uppercase tracking-[.16em] text-lp-gold-deep">
          {eyebrow}
        </p>
        <h1 className="font-lp-heading text-[1.9rem] font-semibold leading-tight tracking-[-.01em] text-lp-navy">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-3.5">
        <span className="hidden text-[.86rem] text-lp-muted sm:inline">{today}</span>
        <span className="sr-only">{t("navHome")}</span>
        <NotificationBell userId={userId} role={role} />
      </div>
    </header>
  );
}

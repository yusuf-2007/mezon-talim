"use client";

import { useTranslations } from "next-intl";
import { Home, BookOpen, MessageCircle, Award, User } from "lucide-react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/** Fixed mobile bottom-tab bar for the student dashboard (safe-area aware). */
export function DashboardTabs() {
  const t = useTranslations("Student");
  const pathname = usePathname();

  const items = [
    { href: "/dashboard", label: t("navHome"), Icon: Home },
    { href: "/dashboard/courses", label: t("navCourses"), Icon: BookOpen },
    { href: "/dashboard/messages", label: t("navMessages"), Icon: MessageCircle },
    { href: "/dashboard/certificates", label: t("navCertificates"), Icon: Award },
    { href: "/dashboard/profile", label: t("navProfile"), Icon: User },
  ];
  const active = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {items.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
              active(href) ? "text-gold-600" : "text-slate-500",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

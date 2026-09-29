"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/** Header nav with the current section in navy — needs the pathname, hence client. */
export function HeaderNav({
  items,
}: {
  items: { href: string; label: string; match?: string[] }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-[30px] text-[.92rem] font-semibold text-lp-slate md:flex">
      {items.map((i) => {
        const on = [i.href, ...(i.match ?? [])].some((p) => pathname.startsWith(p));
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={on ? "page" : undefined}
            className={cn("transition-colors hover:text-lp-navy", on && "text-lp-navy")}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** "UZ · RU · EN" as quiet text links, the active one bold navy. */
export function InlineLanguage({ tone = "light" }: { tone?: "light" | "dark" }) {
  const pathname = usePathname();
  const active = useLocale();
  return (
    <span
      className={cn(
        "flex items-center text-[.8rem]",
        tone === "light" ? "text-lp-muted-light" : "text-lp-on-navy-dim",
      )}
    >
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span aria-hidden className="px-1">·</span>}
          <Link
            href={pathname}
            locale={l}
            aria-current={l === active ? "true" : undefined}
            className={cn(
              "uppercase transition-colors",
              l === active
                ? tone === "light"
                  ? "font-bold text-lp-navy"
                  : "font-bold text-white"
                : tone === "light"
                  ? "hover:text-lp-navy"
                  : "hover:text-white",
            )}
          >
            {l}
          </Link>
        </span>
      ))}
    </span>
  );
}

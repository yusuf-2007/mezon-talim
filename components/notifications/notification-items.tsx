"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { markNotificationReadAction } from "@/lib/notifications/actions";
import { cn } from "@/lib/utils";
import type { BellItem } from "./types";

/** "5 minutes ago" via Intl — no per-unit i18n keys needed. */
export function timeAgo(iso: string, locale: string): string {
  const diffSec = (Date.parse(iso) - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    for (const [unit, sec] of units) {
      if (Math.abs(diffSec) >= sec) return rtf.format(Math.round(diffSec / sec), unit);
    }
    return rtf.format(Math.round(diffSec), "second");
  } catch {
    return new Date(iso).toLocaleDateString(locale);
  }
}

/**
 * The clickable notification rows, shared by the bell dropdown and the
 * /notifications page. Click = best-effort mark-read + deep link.
 */
export function NotificationItems({
  items,
  locale,
  onOpened,
}: {
  items: BellItem[];
  locale: string;
  onOpened?: (id: string) => void;
}) {
  const t = useTranslations("Notifications");
  const router = useRouter();

  function titleFor(n: BellItem): string {
    const name = n.actorName ?? t("someone");
    switch (n.type) {
      case "private_question":
        return t("nPrivateQuestion", { name });
      case "private_reply":
        return t("nPrivateReply", { name });
      case "comment_reply":
        return t("nCommentReply", { name });
      default:
        return t("nLessonComment", { name });
    }
  }

  function openItem(n: BellItem) {
    // Best-effort mark-read: navigation must happen even if it fails.
    if (!n.read) void markNotificationReadAction(n.id).catch(() => {});
    onOpened?.(n.id);
    const [pathname, qs] = n.href.split("?");
    router.push({
      pathname,
      query: Object.fromEntries(new URLSearchParams(qs ?? "")),
    });
  }

  return (
    <ul>
      {items.map((n) => (
        <li key={n.id} className="border-b border-line last:border-b-0">
          <button
            type="button"
            onClick={() => openItem(n)}
            className={cn(
              "block w-full px-4 py-3 text-left transition-colors hover:bg-bg",
              !n.read && "bg-navy-100/40",
            )}
          >
            <p className="text-sm text-ink">
              <span className={cn(!n.read && "font-medium")}>{titleFor(n)}</span>
            </p>
            {n.excerpt && (
              <p className="mt-0.5 truncate text-xs text-slate-500">{n.excerpt}</p>
            )}
            <p className="mt-0.5 text-xs text-slate-400">
              {n.lessonTitle && <span>{n.lessonTitle} · </span>}
              {timeAgo(n.createdAt, locale)}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}

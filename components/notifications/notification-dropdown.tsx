"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/notifications/actions";
import { cn } from "@/lib/utils";

export type BellItem = {
  id: string;
  type: string;
  actorName: string | null;
  lessonTitle: string | null;
  excerpt: string | null;
  read: boolean;
  createdAt: string;
  href: string;
};

/** "5 minutes ago" via Intl — no per-unit i18n keys needed. */
function timeAgo(iso: string, locale: string): string {
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
 * Client half of the header bell: unread badge, dropdown list, mark-read on
 * click (then deep-links to the lesson tab), and mark-all-read.
 */
export function NotificationDropdown({
  unread,
  items,
}: {
  unread: number;
  items: BellItem[];
}) {
  const t = useTranslations("Notifications");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
    setOpen(false);
    // Best-effort mark-read: navigation must happen even if it fails.
    if (!n.read) void markNotificationReadAction(n.id).catch(() => {});
    const [pathname, qs] = n.href.split("?");
    start(() => {
      router.push({
        pathname,
        query: Object.fromEntries(new URLSearchParams(qs ?? "")),
      });
    });
  }

  function markAll() {
    start(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? t("titleWithCount", { count: unread }) : t("title")}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="notification-panel"
        className="relative flex size-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-bg hover:text-navy-800"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-panel"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold text-navy-800">{t("title")}</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-xs font-medium text-navy-600 hover:underline"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              {t("empty")}
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
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
                      <span className={cn(!n.read && "font-medium")}>
                        {titleFor(n)}
                      </span>
                    </p>
                    {n.excerpt && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {n.excerpt}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-400">
                      {n.lessonTitle && <span>{n.lessonTitle} · </span>}
                      {timeAgo(n.createdAt, locale)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

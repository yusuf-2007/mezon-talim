"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { markAllNotificationsReadAction } from "@/lib/notifications/actions";
import { NotificationItems } from "./notification-items";
import type { BellItem } from "./types";

const POLL_MS = 60_000;

/**
 * Client half of the header bell. Server-rendered with initial data, then
 * kept fresh by refetching /api/notifications when the tab regains focus and
 * on a slow interval — so the badge updates without a page navigation.
 */
export function NotificationDropdown({
  initialUnread,
  initialItems,
}: {
  initialUnread: number;
  initialItems: BellItem[];
}) {
  const t = useTranslations("Notifications");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState(initialItems);
  const [, start] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // A navigation re-renders the server component with fresh props — adopt
  // them (render-time reset pattern, not an effect).
  const [lastProps, setLastProps] = useState({ initialUnread, initialItems });
  if (
    lastProps.initialUnread !== initialUnread ||
    lastProps.initialItems !== initialItems
  ) {
    setLastProps({ initialUnread, initialItems });
    setUnread(initialUnread);
    setItems(initialItems);
  }

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?locale=${locale}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data: { unread: number; items: BellItem[] } = await res.json();
      setUnread(data.unread);
      setItems(data.items);
    } catch {
      // Offline / transient — keep showing what we have.
    }
  }, [locale]);

  // Freshness: refetch on tab focus and on a slow poll while visible.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [refresh]);

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

  function onItemOpened(id: string) {
    setOpen(false);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
  }

  function markAll() {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
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
            <div className="max-h-96 overflow-y-auto">
              <NotificationItems items={items} onOpened={onItemOpened} />
            </div>
          )}

          <div className="border-t border-line px-4 py-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-navy-600 hover:underline"
            >
              {t("viewAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

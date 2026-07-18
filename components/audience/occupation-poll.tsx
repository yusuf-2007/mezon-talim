"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/lib/i18n/navigation";

const VID_KEY = "mezon_vid";
const DONE_KEY = "mezon_occ";

const OPTIONS = [
  "student",
  "business_owner",
  "corporate_employee",
  "educator",
  "other",
] as const;

// Only surface on public marketing surfaces — never inside auth, dashboard,
// studio, player, or admin flows.
const PUBLIC_PREFIXES = ["/", "/catalog", "/courses", "/about", "/faq"];
function isPublicPath(path: string): boolean {
  if (path === "/") return true;
  return PUBLIC_PREFIXES.some((p) => p !== "/" && path.startsWith(p));
}

function getVisitorId(): string {
  let id = localStorage.getItem(VID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VID_KEY, id);
  }
  return id;
}

/**
 * One-tap anonymous "what best describes you?" prompt (spec: learn who visits
 * but doesn't register). Shown once per browser — a localStorage flag gates it,
 * not a cookie or IP. The answer is stored anonymously in the in-country DB.
 */
export function OccupationPoll() {
  const t = useTranslations("Audience");
  const locale = useLocale();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!isPublicPath(pathname)) return;
    let already = false;
    try {
      already = localStorage.getItem(DONE_KEY) === "1";
    } catch {
      return; // storage blocked → don't prompt
    }
    if (already) return;
    // Small delay so it doesn't slam the visitor on first paint.
    const id = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(id);
  }, [pathname]);

  function finish(occupation: (typeof OPTIONS)[number] | null) {
    try {
      localStorage.setItem(DONE_KEY, "1");
      const visitorId = getVisitorId();
      void fetch("/api/audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          occupation,
          landingPath: pathname,
          referrer: document.referrer || undefined,
          locale,
        }),
        keepalive: true,
      });
    } catch {
      /* best-effort; never block the visitor */
    }
    setClosing(true);
    setTimeout(() => setShow(false), 200);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      data-closing={closing ? "" : undefined}
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:p-0 motion-safe:animate-[occ-in_.25s_ease]"
    >
      <style>{`
        @keyframes occ-in { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform:none; } }
        [data-closing] { opacity:0; transition: opacity .2s ease; }
      `}</style>
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-heading text-base font-semibold text-navy-800">
              {t("title")}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{t("subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => finish(null)}
            aria-label={t("skip")}
            className="-mr-1 -mt-1 rounded-md p-1 text-slate-400 hover:bg-bg hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => finish(o)}
              className="rounded-lg border border-line bg-bg px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-navy-600 hover:bg-navy-100/40"
            >
              {t(`occ_${o}`)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => finish(null)}
          className="mt-3 text-xs text-slate-400 hover:text-slate-600 hover:underline"
        >
          {t("skip")}
        </button>
      </div>
    </div>
  );
}

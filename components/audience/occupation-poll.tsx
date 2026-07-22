"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const VID_KEY = "mezon_vid";
const DONE_KEY = "mezon_occ";
const T0_KEY = "mezon_t0";

// Engagement gate: never ask before the visitor has had a chance to learn what
// the site is. Fires on whichever lands first — half the page read, or a full
// minute on site — but never inside the first 20s, so a fast thumb-flick to the
// footer doesn't trigger it instantly.
const MIN_DWELL_MS = 20_000;
const DWELL_MS = 60_000;
const SCROLL_RATIO = 0.5;

const OPTIONS = [
  "student",
  "business_owner",
  "corporate_employee",
  "educator",
  "other",
] as const;

// Admin-selectable visual treatment (see settingsRepository.POLL_VARIANTS).
// Kept in sync with that server-side list.
type Variant = "corner" | "modal_blur" | "modal_clear";
const DEFAULT_VARIANT: Variant = "modal_clear";
function isVariant(v: unknown): v is Variant {
  return v === "corner" || v === "modal_blur" || v === "modal_clear";
}

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
 *
 * Deliberately *not* shown on arrival: asking a stranger their profession
 * before they know what Mezon is reads as a data grab and skews the sample
 * toward people who click anything to dismiss it. See the engagement gate above.
 *
 * Presentation is admin-controlled: `corner` toast, or a centered modal with or
 * without a blurred scrim. The gating/recording logic is identical across all.
 */
export function OccupationPoll() {
  const t = useTranslations("Audience");
  const locale = useLocale();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);
  const [variant, setVariant] = useState<Variant>(DEFAULT_VARIANT);

  // Fetch the admin-selected treatment once. Best-effort — the default stands
  // if it fails, and this never blocks the gate below.
  useEffect(() => {
    let alive = true;
    fetch("/api/audience/poll-config")
      .then((r) => r.json())
      .then((d) => {
        if (alive && isVariant(d?.variant)) setVariant(d.variant);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isPublicPath(pathname)) return;

    let t0: number;
    try {
      if (localStorage.getItem(DONE_KEY) === "1") return;
      // Session-wide clock: reading the landing page then clicking through to
      // /about is one continuous visit, so the dwell timer must not reset per
      // page. Cleared by the browser when the tab closes.
      const stored = Number(sessionStorage.getItem(T0_KEY));
      t0 = stored > 0 ? stored : Date.now();
      sessionStorage.setItem(T0_KEY, String(t0));
    } catch {
      return; // storage blocked → don't prompt at all
    }

    let fired = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const elapsed = () => Date.now() - t0;

    const cleanup = () => {
      window.removeEventListener("scroll", onScroll);
      timers.forEach(clearTimeout);
    };

    function fire() {
      if (fired) return;
      fired = true;
      cleanup();
      setShow(true);
    }

    function scrolledEnough(): boolean {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return false; // page too short to measure — fall back to dwell
      return window.scrollY / max >= SCROLL_RATIO;
    }

    function onScroll() {
      if (elapsed() < MIN_DWELL_MS) return;
      if (scrolledEnough()) fire();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    // Re-check once the floor lifts, in case they were already past 50% by then.
    timers.push(setTimeout(onScroll, Math.max(0, MIN_DWELL_MS - elapsed())));
    timers.push(setTimeout(fire, Math.max(0, DWELL_MS - elapsed())));

    return cleanup;
  }, [pathname]);

  /**
   * Answer (`occupation`) or dismiss (`null`). Both retire the prompt for good
   * — deliberate: one ask per browser, never a second. A dismissal is recorded
   * as a null-occupation signal so the admin panel can show the response rate.
   */
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

  const keyframes = (
    <style>{`
      @keyframes occ-fade { from { opacity:0; } to { opacity:1; } }
      @keyframes occ-pop { from { opacity:0; transform: translateY(8px) scale(.97); } to { opacity:1; transform:none; } }
      @keyframes occ-slide { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform:none; } }
      @media (prefers-reduced-motion: no-preference) {
        .occ-scrim { animation: occ-fade .2s ease; }
        .occ-card { animation: occ-pop .28s cubic-bezier(.2,.7,.2,1); }
        .occ-corner { animation: occ-slide .3s cubic-bezier(.2,.7,.2,1); }
      }
      [data-closing] { opacity:0; transition: opacity .2s ease; }
    `}</style>
  );

  // Shared card body — identical across every variant.
  const card = (
    <>
      <button
        type="button"
        onClick={() => finish(null)}
        aria-label={t("skip")}
        className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-bg hover:text-slate-600"
      >
        ✕
      </button>

      <p className="font-heading text-xl font-semibold text-navy-800">{t("title")}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-slate-500">{t("subtitle")}</p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => finish(o)}
            className="rounded-lg border border-line bg-bg px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-navy-600 hover:bg-navy-100/40"
          >
            {t(`occ_${o}`)}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => finish(null)}
        className="mt-5 text-xs text-slate-400 hover:text-slate-600 hover:underline"
      >
        {t("skip")}
      </button>
    </>
  );

  // Corner toast: no scrim, anchored bottom-right, non-modal.
  if (variant === "corner") {
    return (
      <div
        role="dialog"
        aria-label={t("title")}
        data-closing={closing ? "" : undefined}
        className="occ-corner fixed bottom-4 right-4 z-[60] w-[calc(100%-2rem)] max-w-sm sm:bottom-6 sm:right-6"
      >
        {keyframes}
        <div className="relative rounded-2xl border border-line bg-surface p-6 text-center shadow-2xl">
          {card}
        </div>
      </div>
    );
  }

  // Centered modal, with or without a blurred scrim. Backdrop click dismisses.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      data-closing={closing ? "" : undefined}
      onClick={() => finish(null)}
      className={cn(
        "occ-scrim fixed inset-0 z-[60] grid place-items-center bg-navy-900/50 p-4",
        variant === "modal_blur" && "backdrop-blur-sm",
      )}
    >
      {keyframes}
      <div
        onClick={(e) => e.stopPropagation()}
        className="occ-card relative w-full max-w-md rounded-2xl border border-line bg-surface p-7 text-center shadow-2xl"
      >
        {card}
      </div>
    </div>
  );
}

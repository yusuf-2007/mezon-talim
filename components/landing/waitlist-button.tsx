"use client";

/**
 * "Join the waiting list" sits inside the apply section, so its original
 * href="#ariza" scrolled the page to where it already was — a control that
 * looked interactive and did nothing.
 *
 * The form *is* the waiting-list mechanism (the copy says as much: if the
 * cohort is full, an application becomes a waiting-list entry), so this focuses
 * the first field instead.
 */
export function WaitlistButton({
  label,
  targetId,
}: {
  label: string;
  targetId: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const el = document.getElementById(targetId);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus({ preventScroll: true });
      }}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border-[1.5px] border-white/28 bg-white/8 px-[18px] py-[11px] text-[0.9rem] font-semibold text-white transition-colors hover:bg-white/15"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-lp-gold"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
      {label}
    </button>
  );
}

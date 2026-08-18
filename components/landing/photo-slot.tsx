import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A frame that will hold real photography once Mezon supplies it (the brief
 * lists photos as pending). Until then it renders the design's dashed-ring
 * placeholder over the navy backdrop, so the layout is already correct at the
 * final dimensions. Pass `src` when the photo arrives — nothing else changes.
 */
export function PhotoSlot({
  src,
  caption,
  className,
}: {
  src?: string;
  caption: string;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={caption}
        fill
        sizes="(max-width: 980px) 100vw, 460px"
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "absolute inset-0 grid place-items-center bg-lp-navy-dark p-3 text-center",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 border-[1.5px] border-dashed border-white/25"
      />
      <span className="flex flex-col items-center gap-1.5">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white/45"
          aria-hidden
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <span className="max-w-[90%] text-xs font-medium text-white/55">
          {caption}
        </span>
      </span>
    </div>
  );
}

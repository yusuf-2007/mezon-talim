import { cn } from "@/lib/utils";

/**
 * The Mezon lattice — the eight-point star from the brand mark, tiled.
 *
 * It appears on every navy surface in the design at 5–10% opacity, which is
 * the point: it should register as woven texture, not as a pattern anyone
 * stops to look at. Inlined as a data URI rather than a file because it is two
 * paths and a stroke, and a request for that costs more than it saves.
 */
export function Lattice({
  size = 46,
  opacity = 0.06,
  color = "%23ffffff",
  className,
}: {
  size?: number;
  opacity?: number;
  color?: string;
  className?: string;
}) {
  const half = size / 2;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><path d='M${half} 1 L${size - 1} ${half} L${half} ${size - 1} L1 ${half} Z' fill='none' stroke='${color}' stroke-opacity='${opacity}' stroke-width='1'/></svg>`;
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,${svg}")`,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  );
}

/** The gold corner brackets that frame the design's hero media and documents. */
export function CornerMarks({ inset = "-8px", size = "22px" }: { inset?: string; size?: string }) {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute border-l-2 border-t-2 border-lp-gold"
        style={{ top: inset, left: inset, width: size, height: size }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute border-b-2 border-r-2 border-lp-gold"
        style={{ bottom: inset, right: inset, width: size, height: size }}
      />
    </>
  );
}

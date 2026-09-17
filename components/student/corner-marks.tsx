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

import { cn } from "@/lib/utils";

/**
 * A visible `[BRACKETED]` placeholder for a fact Mezon has not supplied yet
 * (price, cohort dates, contacts, legal requisites). Deliberately conspicuous —
 * the design brief forbids inventing any of these, so they must read as
 * unfilled rather than quietly plausible.
 *
 * `tone="navy"` for placement on a navy band, `"light"` on a light section.
 */
export function Bracket({
  children,
  tone = "light",
  className,
}: {
  children: React.ReactNode;
  tone?: "navy" | "light";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-md border border-dashed font-mono font-semibold",
        tone === "navy"
          ? "border-lp-gold/60 bg-lp-gold/8 text-lp-gold-light"
          : "border-lp-gold-deep bg-lp-gold-wash text-lp-gold-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

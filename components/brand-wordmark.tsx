import { cn } from "@/lib/utils";

/**
 * Text wordmark placeholder until Mezon supplies the open-book logo lockups.
 * `tone="light"` for navy backgrounds (white text), `tone="dark"` on light.
 */
export function BrandWordmark({
  tone = "dark",
  className,
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-heading text-lg font-semibold tracking-tight",
        tone === "light" ? "text-white" : "text-navy-800",
        className,
      )}
    >
      Mezon <span className="text-gold-500">Ta&apos;lim</span>
    </span>
  );
}

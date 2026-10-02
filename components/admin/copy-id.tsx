"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * A shortened identifier that copies the full one on click.
 *
 * Payment IDs are UUIDs: too long for a table cell, but the full value is what
 * Payme, Click and support tickets ask for — the first 8 characters match
 * nothing anywhere else.
 */
export function CopyId({ value, display, label }: { value: string; display: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={value}
      aria-label={`${label}: ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard is permission-gated; the full value is still in the tooltip.
        }
      }}
      className="inline-flex items-center gap-1.5 rounded font-mono text-[.78rem] text-lp-muted tabular-nums transition-colors hover:text-lp-navy"
    >
      {display}
      {copied ? (
        <Check className="size-3 text-lp-success" strokeWidth={2.5} />
      ) : (
        <Copy className="size-3" strokeWidth={2} />
      )}
    </button>
  );
}

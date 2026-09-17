"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Copies the public verification URL.
 *
 * Built from `window.location.origin` at click time rather than from a server
 * prop: the same certificate is reachable on the vercel.app host and (once it
 * is attached) on mezontalim.uz, and the link worth sharing is the one the
 * student is actually looking at.
 */
export function CopyLinkButton({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className="flex-1 border-lp-line"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/verify/${code}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard is permission-gated and throws on an insecure origin;
          // the verification page is one tap away either way.
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {label}
    </Button>
  );
}

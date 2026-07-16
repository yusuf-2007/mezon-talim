"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { requestRetryAction } from "@/lib/assessments/actions";
import { Button } from "@/components/ui/button";

/**
 * "Request exam access" — student is out of attempts (spec 1.5/2.2b). Fires the
 * retry-request action (records an admin signal; grants nothing). Collapses to a
 * confirmation once sent.
 */
export function RequestAccessButton({
  assessmentId,
  alreadyRequested,
}: {
  assessmentId: string;
  alreadyRequested: boolean;
}) {
  const t = useTranslations("Exam");
  const [sent, setSent] = useState(alreadyRequested);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <p className="rounded-lg bg-gold-100 px-4 py-3 text-sm text-navy-800">
        {t("accessRequested")}
      </p>
    );
  }

  return (
    <Button
      size="lg"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await requestRetryAction(assessmentId);
          if (res.ok) setSent(true);
        })
      }
    >
      {t("requestAccess")}
    </Button>
  );
}

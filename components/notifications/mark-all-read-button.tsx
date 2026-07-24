"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { markAllNotificationsReadAction } from "@/lib/notifications/actions";
import { Button } from "@/components/ui/button";

/** Mark-all-read for the /notifications page (refreshes the server list). */
export function MarkAllReadButton() {
  const t = useTranslations("Notifications");
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markAllNotificationsReadAction();
          router.refresh();
        })
      }
    >
      {t("markAllRead")}
    </Button>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * `ghost` carries no text colour of its own, so on a navy ground it inherits
 * the light-theme foreground and all but vanishes. Navy placements pass their
 * own colours through `className`.
 */
export function LogoutButton({
  variant = "outline",
  size = "sm",
  className,
}: {
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default";
  className?: string;
}) {
  const t = useTranslations("Auth");
  return (
    <form action={logoutAction}>
      <Button
        type="submit"
        variant={variant}
        size={size}
        className={cn("min-h-11", className)}
      >
        {t("logout")}
      </Button>
    </form>
  );
}

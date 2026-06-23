"use client";

import { useTranslations } from "next-intl";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton({
  variant = "outline",
  size = "sm",
}: {
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default";
}) {
  const t = useTranslations("Auth");
  return (
    <form action={logoutAction}>
      <Button type="submit" variant={variant} size={size}>
        {t("logout")}
      </Button>
    </form>
  );
}

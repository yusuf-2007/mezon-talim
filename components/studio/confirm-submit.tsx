"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Submit button that asks for confirmation before posting its parent form.
 * Used for destructive actions (delete course/module/lesson). The actual work
 * is a server action set as the form's `action`.
 */
export function ConfirmSubmit({
  label,
  confirmMessage,
  variant = "ghost",
  size = "sm",
}: {
  label: string;
  confirmMessage?: string;
  variant?: "ghost" | "outline" | "destructive" | "default";
  size?: "sm" | "default";
}) {
  const t = useTranslations("Studio");
  const message = confirmMessage ?? t("confirmDelete");
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className="text-danger hover:text-danger"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {label}
    </Button>
  );
}

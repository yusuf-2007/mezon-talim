"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setUserRoleAction } from "@/lib/admin/actions";

const ROLES = ["student", "teacher", "accountant", "super_admin"] as const;

/** Inline role changer for the admin users table. */
export function RoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: string;
  disabled?: boolean;
}) {
  const t = useTranslations("Admin");
  const [value, setValue] = useState(role);
  const [pending, start] = useTransition();

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    start(async () => {
      try {
        await setUserRoleAction(userId, next);
      } catch {
        setValue(prev); // revert on failure
      }
    });
  }

  return (
    <select
      value={value}
      disabled={disabled || pending}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink disabled:opacity-50"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {t(`role_${r}`)}
        </option>
      ))}
    </select>
  );
}

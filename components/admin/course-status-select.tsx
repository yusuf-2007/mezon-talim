"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setCourseStatusAdminAction } from "@/lib/admin/actions";

const STATUSES = ["draft", "published", "archived"] as const;

/** Inline status changer for the admin courses table. */
export function CourseStatusSelect({
  courseId,
  status,
}: {
  courseId: string;
  status: string;
}) {
  const t = useTranslations("Admin");
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    start(async () => {
      try {
        await setCourseStatusAdminAction(courseId, next);
      } catch {
        setValue(prev);
      }
    });
  }

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`status_${s}`)}
        </option>
      ))}
    </select>
  );
}

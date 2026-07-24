"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "@/lib/i18n/navigation";

/**
 * Course filter that applies itself on selection — no separate submit button.
 * Updates the `courseId` search param in place (keeps the URL shareable).
 */
export function CourseFilter({
  courses,
  current,
  placeholder,
}: {
  courses: { id: string; label: string }[];
  current: string;
  placeholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  function onChange(courseId: string) {
    start(() => {
      router.replace(
        courseId
          ? { pathname, query: { courseId } }
          : { pathname },
      );
    });
  }

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      disabled={pending}
      aria-label={placeholder}
      className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink disabled:opacity-50"
    >
      <option value="">{placeholder}</option>
      {courses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/**
 * Pick a course from a dropdown and run a bound (userId, courseId) server action
 * — used on the user-detail page for "enroll in course" and "issue certificate".
 */
export function CoursePicker({
  userId,
  courses,
  action,
  buttonLabel,
  placeholder,
}: {
  userId: string;
  courses: { id: string; label: string }[];
  action: (userId: string, courseId: string) => Promise<void>;
  buttonLabel: string;
  placeholder: string;
}) {
  const [courseId, setCourseId] = useState("");
  const [pending, start] = useTransition();

  if (courses.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        disabled={pending}
        className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
      >
        <option value="">{placeholder}</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        disabled={!courseId || pending}
        onClick={() => courseId && start(() => action(userId, courseId))}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}

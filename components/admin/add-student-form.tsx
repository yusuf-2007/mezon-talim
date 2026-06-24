"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { adminEnrollAction } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";

/**
 * Small client form to enroll a student into a course. Renders a select of
 * candidate users and submits via the bound server action in a transition.
 */
export function AddStudentForm({
  courseId,
  users,
}: {
  courseId: string;
  users: { id: string; label: string }[];
}) {
  const t = useTranslations("Admin");
  const [userId, setUserId] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    start(async () => {
      await adminEnrollAction(userId, courseId);
      setUserId("");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <select
        name="userId"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        disabled={pending}
        className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink disabled:opacity-50"
      >
        <option value="">{t("addStudents")}</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending || !userId}>
        {t("enroll")}
      </Button>
    </form>
  );
}

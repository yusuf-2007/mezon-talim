"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { adminEnrollAction } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * "Enroll students" flow: a button that opens a centered dialog with a search
 * box and a multi-select checkbox list of candidate users, then enrolls all
 * selected in one go. Replaces the old single-select dropdown, which didn't
 * scale past a handful of students.
 */
export function EnrollStudentsDialog({
  courseId,
  users,
}: {
  courseId: string;
  users: { id: string; label: string }[];
}) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  // Esc closes (unless an enroll is in flight).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter((u) => u.label.toLowerCase().includes(q)) : users;
  }, [users, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function close() {
    setOpen(false);
    setQuery("");
    setSelected(new Set());
  }

  function enroll() {
    if (selected.size === 0) return;
    start(async () => {
      for (const userId of selected) {
        await adminEnrollAction(userId, courseId);
      }
      close();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {t("enroll")}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("addStudents")}
        >
          {/* Scrim */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="absolute inset-0 bg-navy-900/50"
            onClick={() => !pending && close()}
          />

          <div className="relative w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-xl">
            <h3 className="font-heading text-lg font-semibold text-navy-800">
              {t("addStudents")}
            </h3>

            <div className="mt-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchStudents")}
                autoFocus
                disabled={pending}
              />
            </div>

            <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  {t("noStudentsFound")}
                </p>
              ) : (
                filtered.map((u) => (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-bg"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggle(u.id)}
                      disabled={pending}
                      className="size-4 shrink-0 accent-navy-800"
                    />
                    <span className="truncate">{u.label}</span>
                  </label>
                ))
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
              <span className="text-xs text-slate-500">
                {t("selectedCount", { count: selected.size })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={close}
                  disabled={pending}
                >
                  {t("cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={enroll}
                  disabled={pending || selected.size === 0}
                >
                  {t("enroll")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

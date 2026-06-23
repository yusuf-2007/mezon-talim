"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ContentFormState } from "@/lib/content/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LessonForm } from "./lesson-form";
import { ConfirmSubmit } from "./confirm-submit";

type LessonLike = {
  id: string;
  title: { uz: string; ru?: string };
  body?: { uz: string; ru?: string } | null;
  bunnyVideoId?: string | null;
  durationSeconds?: number | null;
  isPreview: boolean;
};

type Action = (prev: ContentFormState, fd: FormData) => Promise<ContentFormState>;

/** A single lesson row with an inline edit toggle and a delete form. */
export function LessonRow({
  lesson,
  updateAction,
  deleteAction,
}: {
  lesson: LessonLike;
  updateAction: Action;
  deleteAction: () => Promise<void>;
}) {
  const t = useTranslations("Studio");
  const [editing, setEditing] = useState(false);

  return (
    <li className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{lesson.title.uz}</span>
          {lesson.isPreview && (
            <Badge className="bg-gold-100 text-navy-800">{t("previewBadge")}</Badge>
          )}
          {lesson.bunnyVideoId && (
            <span className="text-xs text-slate-500">▶ {lesson.bunnyVideoId.slice(0, 8)}…</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>
            {editing ? t("cancel") : t("editLesson")}
          </Button>
          <form action={deleteAction}>
            <ConfirmSubmit label={t("delete")} />
          </form>
        </div>
      </div>
      {editing && (
        <div className="mt-3">
          <LessonForm
            action={updateAction}
            lesson={lesson}
            mode="edit"
            onDone={() => setEditing(false)}
          />
        </div>
      )}
    </li>
  );
}

/** Collapsible "add lesson" affordance under a module. */
export function AddLesson({ action }: { action: Action }) {
  const t = useTranslations("Studio");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + {t("addLesson")}
      </Button>
    );
  }
  return (
    <LessonForm action={action} mode="create" onDone={() => setOpen(false)} />
  );
}

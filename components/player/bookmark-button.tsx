"use client";

import { Bookmark, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { bookmarkAction } from "@/lib/learning/actions";
import { getVideoTime } from "./video-time-store";

/**
 * "Save" marks the moment the student is at, as a note pinned to the video's
 * current time. Bookmarks and notes are the same thing here (B7 + B8): a
 * bookmark is simply a note with a timestamp and no text of its own yet.
 */
export function BookmarkButton({ lessonId }: { lessonId: string }) {
  const t = useTranslations("Player");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await bookmarkAction(lessonId, Math.floor(getVideoTime()));
      if (res.ok) setSaved(true);
    });
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-[9px] border-[1.5px] border-lp-line bg-white px-3.5 py-[9px] text-[.86rem] font-bold text-lp-navy transition-colors hover:bg-lp-wash disabled:opacity-60"
    >
      {saved ? (
        <Check className="size-3.5" strokeWidth={2.5} />
      ) : (
        <Bookmark className="size-3.5" strokeWidth={2} />
      )}
      {saved ? t("bookmarked") : t("bookmark")}
    </button>
  );
}

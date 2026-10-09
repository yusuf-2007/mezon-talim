"use client";

import { useEffect } from "react";
import { markVideoOpenedAction } from "@/lib/learning/actions";

/**
 * Records that the student opened this part (resume + completion), once per
 * part shown. A client effect rather than a write during the page render, so
 * a link prefetch never counts as "opened". Renders nothing.
 */
export function MarkPartOpened({ lessonId, videoId }: { lessonId: string; videoId: string }) {
  useEffect(() => {
    void markVideoOpenedAction(lessonId, videoId).catch(() => {
      // Best effort: "Mark complete" sends the part on screen as well.
    });
  }, [lessonId, videoId]);
  return null;
}

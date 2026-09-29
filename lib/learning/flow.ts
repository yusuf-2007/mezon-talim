import type { Curriculum } from "./curriculum";
import type { LocalizedText } from "@/lib/db/schema";

/**
 * One view of the curriculum for every learning-flow screen: the course page,
 * the lesson rail, and the exam requirements all draw the same row of states,
 * so they are computed once here rather than re-derived in each page.
 */
export type FlowLessonState = "done" | "current" | "locked" | "preview";

export type FlowLesson = {
  id: string;
  title: LocalizedText;
  /** 1-based, across the whole course. */
  number: number;
  /** 1-based position of its module. */
  moduleNumber: number;
  state: FlowLessonState;
  /** Whether the viewer may open it. */
  openable: boolean;
  durationSeconds: number | null;
};

export type FlowModule = {
  id: string;
  title: LocalizedText;
  number: number;
  lessons: FlowLesson[];
  done: number;
};

export function buildFlow(c: Curriculum): { modules: FlowModule[]; lessons: FlowLesson[] } {
  let n = 0;
  const modules = c.modules.map((m, mi) => {
    const lessons = m.lessons.map<FlowLesson>((l) => {
      n += 1;
      const state: FlowLessonState = l.completed
        ? "done"
        : c.enrolled && l.id === c.resumeLessonId
          ? "current"
          : !c.enrolled && l.isPreview
            ? "preview"
            : "locked";
      return {
        id: l.id,
        title: l.title,
        number: n,
        moduleNumber: mi + 1,
        state,
        openable: l.accessible,
        durationSeconds: l.durationSeconds,
      };
    });
    return {
      id: m.id,
      title: m.title,
      number: mi + 1,
      lessons,
      done: lessons.filter((l) => l.state === "done").length,
    };
  });
  return { modules, lessons: modules.flatMap((m) => m.lessons) };
}

/** "10 daqiqa" style minutes from seconds; null for untimed. */
export function minutesOf(seconds: number | null | undefined): number | null {
  return seconds ? Math.max(1, Math.round(seconds / 60)) : null;
}

/** 38:00 / 1:02:05 */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

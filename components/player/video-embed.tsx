"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { answerVideoQuestionAction } from "@/lib/learning/video-question-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getVideoTime, setVideoTime } from "./video-time-store";

/** Serialized popup question — deliberately WITHOUT the correct answer. */
export type VideoPopupQuestion = {
  id: string;
  t: number;
  prompt: string;
  options: string[];
  answered: boolean;
  /** Whether this student got it right; null when not answered yet. */
  correct: boolean | null;
};

/**
 * Marker palette. These cross into Bunny's cross-origin iframe as literal
 * colours (no stylesheet reaches in there), so they must be hex rather than
 * design tokens — keep in sync with --color-gold-500/success/danger.
 */
const MARKER_COLORS = {
  unanswered: "#f8b801",
  correct: "#1e9e6a",
  wrong: "#d14343",
} as const;

/**
 * Where a marker click lands. Aiming a second early keeps the crossing
 * detector armed, so jumping to an unanswered question still pops it.
 */
function markerSeek(t: number): number {
  return Math.max(0, t - 1);
}

type VideoMarker = { t: number; seek: number; color: string };

/**
 * Bunny renders our question timestamps as "moments" on its own seek bar, but
 * moments are per-video — the player has no idea who is watching. The library's
 * custom-head script (docs/bunny-player-customization.md) listens for this
 * message to colour each marker per student and to snap marker clicks to the
 * exact timestamp. Harmless no-op when that script isn't pasted.
 */
function sendMarkers(
  iframe: HTMLIFrameElement | null,
  src: string,
  markers: VideoMarker[],
) {
  const win = iframe?.contentWindow;
  if (!win) return;
  let origin = "*";
  try {
    origin = new URL(src).origin;
  } catch {
    /* dev fallback URL — fall back to a wildcard target */
  }
  win.postMessage({ __mezon: "vq", markers }, origin);
}

/** Where the player reports the playhead (resume, B3). */
const POSITION_URL = "/api/learn/position";
/** Report the playhead after this many seconds of playback since the last report. */
const REPORT_EVERY_SECONDS = 10;

/** Which part of which lesson is playing, for saving the playhead. */
export type VideoPosition = { lessonId: string; videoId: string };

/** Whether the fullscreen element is the video (or something holding it). */
function isVideoFullscreen(iframe: HTMLIFrameElement | null): boolean {
  const el = document.fullscreenElement;
  return Boolean(el && iframe && (el === iframe || el.contains(iframe)));
}

/**
 * The question over a fullscreen video. The fullscreen iframe sits in the
 * browser's top layer, above everything on the page; a modal <dialog> opened
 * after it joins the top layer above it, so the question shows while the
 * video stays fullscreen. Escape does not dismiss it: skip or answer.
 */
function FullscreenQuestion({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  // Before paint, so it never flashes as an ordinary in-page box.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(e) => e.preventDefault()}
      className="fixed inset-0 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-navy-900/85 p-4 backdrop:bg-transparent"
    >
      {children}
    </dialog>
  );
}

function fmt(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/**
 * Client wrapper around the Bunny Stream iframe. Bunny's embed speaks the
 * player.js postMessage protocol: we subscribe to `timeupdate` (powering the
 * note-form "current time" checkbox) and, when the playhead crosses an
 * in-video question timestamp during normal playback, pause the player and
 * show the question overlay (Coursera-style). Answered/skipped questions
 * don't re-pop. A marker strip under the video shows question positions —
 * Bunny's own seek bar is cross-origin, so markers can't be drawn inside it.
 *
 * With `position`, the playhead is saved as the student watches, so the next
 * visit starts where they left off (`startAt`, already in `src` as `t`).
 */
export function VideoEmbed({
  src,
  title,
  questions = [],
  initialDuration = 0,
  position = null,
  startAt = 0,
}: {
  src: string;
  title: string;
  questions?: VideoPopupQuestion[];
  initialDuration?: number;
  /** Save the playhead for this part (enrolled students only). */
  position?: VideoPosition | null;
  /** Where playback starts: the saved playhead, or 0. */
  startAt?: number;
}) {
  const t = useTranslations("Player");
  const ref = useRef<HTMLIFrameElement>(null);

  const [duration, setDuration] = useState(initialDuration);
  const [playedSec, setPlayedSec] = useState(0);
  const [active, setActive] = useState<VideoPopupQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; correctIndex: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  // The fullscreen element is the video: the question opens as a top-layer
  // dialog over it instead of dropping the student out of fullscreen.
  const [fullscreen, setFullscreen] = useState(false);
  // "Resuming from 12:34 · Start over", until the student is well past it.
  const [resumeNote, setResumeNote] = useState(startAt > 0);

  // Per-question outcome (id → got it right), seeded from the server and kept
  // current as the student answers. Drives marker colour on both seek bars.
  // A skipped question stays absent here — no answer, so it stays gold.
  const [outcomes, setOutcomes] = useState<Map<string, boolean>>(
    () =>
      new Map(
        questions
          .filter((q) => q.correct != null)
          .map((q) => [q.id, q.correct as boolean]),
      ),
  );

  function markerColor(q: VideoPopupQuestion): string {
    const outcome = outcomes.get(q.id);
    if (outcome === undefined) return MARKER_COLORS.unanswered;
    return outcome ? MARKER_COLORS.correct : MARKER_COLORS.wrong;
  }

  // Refs mirror state used inside the message handler (bound once per src).
  const lastTimeRef = useRef(0);
  const activeRef = useRef(false);
  // Playhead reporting: the last value sent, and whether the player has
  // reported a real playhead yet (never overwrite the saved one with the 0 a
  // video sits at before it starts).
  const positionRef = useRef(position);
  const savedAtRef = useRef(startAt);
  const playingRef = useRef(false);
  const resumeSeekedRef = useRef(false);
  const doneRef = useRef<Set<string>>(new Set());
  const questionsRef = useRef(questions);
  useEffect(() => {
    questionsRef.current = questions;
    const answered = new Set(questions.filter((q) => q.answered).map((q) => q.id));
    for (const id of answered) doneRef.current.add(id);
  }, [questions]);

  function post(method: string, value?: unknown) {
    ref.current?.contentWindow?.postMessage(
      JSON.stringify({
        context: "player.js",
        version: "0.0.11",
        method,
        ...(value !== undefined ? { value } : {}),
      }),
      "*",
    );
  }

  const markers = useMemo(
    () =>
      questions.map((q) => ({
        t: q.t,
        seek: markerSeek(q.t),
        color: markerColor(q),
      })),
    // markerColor closes over `outcomes`, so recompute when either changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, outcomes],
  );
  // Read by the src-scoped effect below, which binds once per lesson.
  const markersRef = useRef<VideoMarker[]>(markers);

  // Move focus into the question when it opens: it is a modal, and focus would
  // otherwise stay in the cross-origin iframe behind it.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) dialogRef.current?.focus();
  }, [active, fullscreen]);

  useEffect(() => {
    const sync = () => setFullscreen(isVideoFullscreen(ref.current));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // Re-broadcast whenever a marker changes colour (i.e. right after answering).
  useEffect(() => {
    markersRef.current = markers;
    sendMarkers(ref.current, src, markers);
  }, [markers, src]);

  // VideoFrame keys this component by src, so a lesson change remounts it and
  // all state starts fresh; the effect only needs to reset the shared store
  // and the crossing cursor (-1 so a question at t=0 satisfies `q.t > last`).
  useEffect(() => {
    setVideoTime(0);
    lastTimeRef.current = -1;
    activeRef.current = false;
    const iframe = ref.current;
    if (!iframe) return;

    // Send the playhead if it moved since the last report. `leaving`: the tab
    // is going away, so use a beacon, which outlives the page.
    const report = (leaving = false) => {
      const at = positionRef.current;
      if (!at || !playingRef.current) return;
      const seconds = Math.floor(getVideoTime());
      if (seconds === savedAtRef.current) return;
      savedAtRef.current = seconds;
      const body = JSON.stringify({ ...at, seconds });
      if (leaving && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(POSITION_URL, body);
        return;
      }
      void fetch(POSITION_URL, { method: "POST", body, keepalive: true }).catch(() => {
        // Best effort: the next report carries the newer playhead anyway.
      });
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") report(true);
    };
    const onPageHide = () => report(true);

    const subscribe = () => {
      for (const [value, listener] of [
        ["timeupdate", "mezon-note-time"],
        ["pause", "mezon-pause"],
        ["ended", "mezon-ended"],
      ]) {
        iframe.contentWindow?.postMessage(
          JSON.stringify({
            context: "player.js",
            version: "0.0.11",
            method: "addEventListener",
            value,
            listener,
          }),
          "*",
        );
      }
      sendMarkers(iframe, src, markersRef.current);
    };

    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      let data: unknown = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const msg = data as {
        context?: string;
        event?: string;
        value?: { seconds?: number; duration?: number };
      };
      if (msg?.context !== "player.js") return;
      if (msg.event === "ready") subscribe();
      if (msg.event === "pause" || msg.event === "ended") report();
      if (msg.event === "timeupdate" && typeof msg.value?.seconds === "number") {
        const now = msg.value.seconds;
        setVideoTime(now);

        // Resume: `t` in the embed URL starts the video at the saved playhead.
        // Should a player ignore it and start at 0, seek there once.
        if (!playingRef.current && startAt > 0 && !resumeSeekedRef.current && now < startAt - 3) {
          resumeSeekedRef.current = true;
          lastTimeRef.current = now;
          post("setCurrentTime", startAt);
          return;
        }
        if (now >= 1) playingRef.current = true;
        if (Math.abs(now - savedAtRef.current) >= REPORT_EVERY_SECONDS) report();
        if (now > startAt + 20) setResumeNote(false);
        if (typeof msg.value.duration === "number" && msg.value.duration > 0) {
          setDuration((d) => (d === msg.value!.duration ? d : msg.value!.duration!));
        }
        setPlayedSec((p) => (Math.floor(now) === p ? p : Math.floor(now)));

        const last = lastTimeRef.current;
        lastTimeRef.current = now;
        // Trigger only while playing forward normally (not on big seeks), and
        // never while a question is already open.
        if (activeRef.current || now <= last || now - last > 3) return;
        const hit = questionsRef.current.find(
          (q) => !doneRef.current.has(q.id) && q.t > last && q.t <= now,
        );
        if (hit) {
          activeRef.current = true;
          post("pause");
          // Fullscreen stays as it is: FullscreenQuestion shows over it.
          setFullscreen(isVideoFullscreen(iframe));
          setSelected(null);
          setResult(null);
          setFailed(false);
          setActive(hit);
        }
      }
    };

    window.addEventListener("message", onMessage);
    // The player may have finished loading before this page hydrated, in which
    // case neither 'ready' nor 'load' reaches us: subscribe now as well.
    subscribe();
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    // The embed may already be past 'ready' by the time we mount — also try on load.
    iframe.addEventListener("load", subscribe);
    // ...and if it was served from cache, neither may fire, so nudge the marker
    // state across once the custom-head script has certainly parsed.
    const nudges = [1200, 4000].map((ms) =>
      setTimeout(() => sendMarkers(iframe, src, markersRef.current), ms),
    );
    return () => {
      // Leaving the lesson inside the app (next lesson, another part).
      report(true);
      window.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      iframe.removeEventListener("load", subscribe);
      nudges.forEach(clearTimeout);
    };
    // startAt is fixed for a given src (both come from the same render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function submit() {
    if (!active || selected == null) return;
    start(async () => {
      const res = await answerVideoQuestionAction(active.id, selected);
      if (res.ok) {
        setFailed(false);
        setResult({ correct: res.correct, correctIndex: res.correctIndex });
        setOutcomes((prev) => new Map(prev).set(active.id, res.correct));
      } else {
        setFailed(true);
      }
    });
  }

  function closeQuestion() {
    if (active) {
      doneRef.current.add(active.id);
      // Rewind the crossing cursor to this question's time so a second
      // question inside the same timeupdate window still triggers next tick.
      lastTimeRef.current = active.t;
    }
    activeRef.current = false;
    setActive(null);
    post("play");
  }

  function startOver() {
    resumeSeekedRef.current = true;
    setResumeNote(false);
    lastTimeRef.current = -1;
    post("setCurrentTime", 0);
    post("play");
  }

  const dur = duration > 0 ? duration : initialDuration;

  // One question card, shown over the video in the page or, when the video is
  // fullscreen, in a top-layer dialog over that.
  const questionCard = active && (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-surface p-5 shadow-xl outline-none"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-gold-500">
        {t("vqLabel")}
      </p>
      <p className="mt-1.5 font-medium text-ink">{active.prompt}</p>

      <div className="mt-4 space-y-2">
        {active.options.map((opt, i) => {
          const isSel = selected === i;
          const showCorrect = result != null && i === result.correctIndex;
          const showWrong = result != null && isSel && !result.correct;
          return (
            <button
              key={i}
              type="button"
              disabled={result != null || pending}
              onClick={() => setSelected(i)}
              className={cn(
                "block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                showCorrect
                  ? "border-success bg-success/10 text-ink"
                  : showWrong
                    ? "border-danger bg-danger/10 text-ink"
                    : isSel
                      ? "border-navy-800 bg-navy-100/60 text-ink"
                      : "border-line bg-bg text-ink hover:border-navy-600",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        {result ? (
          <p
            className={cn(
              "text-sm font-semibold",
              result.correct ? "text-success" : "text-danger",
            )}
          >
            {result.correct ? t("vqCorrect") : t("vqWrong")}
          </p>
        ) : (
          <span className="text-xs text-danger">
            {failed ? t("msgError") : ""}
          </span>
        )}
        <div className="flex gap-2">
          {result == null && (
            <>
              <Button variant="ghost" size="sm" onClick={closeQuestion}>
                {t("vqSkip")}
              </Button>
              <Button
                size="sm"
                disabled={selected == null || pending}
                onClick={submit}
              >
                {t("vqCheck")}
              </Button>
            </>
          )}
          {result != null && (
            <Button size="sm" onClick={closeQuestion}>
              {t("vqContinue")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {/* data-lesson-video: the slide shield (use-slide-shield.ts) treats
            focus moving in here as the student using the video, not leaving. */}
        <iframe
          ref={ref}
          src={src}
          title={title}
          data-lesson-video=""
          loading="lazy"
          allow="accelerated-2d-canvas; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />

        {active && !fullscreen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("vqLabel")}
            /* On a phone the 16:9 box is ~200px tall — far too short for a
               prompt plus four options, and the parent clips overflow, so the
               answer buttons became unreachable. Below `sm` the overlay covers
               the viewport instead; from `sm` up it stays over the video. */
            className="absolute inset-0 z-10 flex items-center justify-center bg-navy-900/85 p-4 max-sm:fixed max-sm:z-50 max-sm:p-3"
          >
            {questionCard}
          </div>
        )}
        {active && fullscreen && (
          <FullscreenQuestion label={t("vqLabel")}>{questionCard}</FullscreenQuestion>
        )}
      </div>

      {resumeNote && (
        <p className="flex flex-wrap items-center gap-x-2 px-3 py-2 text-[.8rem] text-lp-on-navy">
          <span>{t("resumedFrom", { time: fmt(startAt) })}</span>
          <button
            type="button"
            onClick={startOver}
            className="font-bold text-lp-gold-light underline-offset-2 hover:underline"
          >
            {t("startOver")}
          </button>
        </p>
      )}

      {/* Question markers under the video (Bunny's seek bar is cross-origin). */}
      {questions.length > 0 && dur > 0 && (
        <div className="mt-2 px-0.5">
          <div className="relative h-1.5 rounded-full bg-navy-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-navy-600/40"
              style={{ width: `${Math.min(100, (playedSec / dur) * 100)}%` }}
            />
            {questions.map((q) => (
              <button
                key={q.id}
                type="button"
                title={`${t("vqLabel")} · ${fmt(q.t)}`}
                aria-label={`${t("vqLabel")} ${fmt(q.t)}`}
                onClick={() => post("setCurrentTime", markerSeek(q.t))}
                className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
                style={{
                  left: `${Math.min(99.5, (q.t / dur) * 100)}%`,
                  backgroundColor: markerColor(q),
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

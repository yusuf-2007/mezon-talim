"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { answerVideoQuestionAction } from "@/lib/learning/video-question-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setVideoTime } from "./video-time-store";

/** Serialized popup question — deliberately WITHOUT the correct answer. */
export type VideoPopupQuestion = {
  id: string;
  t: number;
  prompt: string;
  options: string[];
  answered: boolean;
};

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
 */
export function VideoEmbed({
  src,
  title,
  questions = [],
  initialDuration = 0,
}: {
  src: string;
  title: string;
  questions?: VideoPopupQuestion[];
  initialDuration?: number;
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

  // Answered/skipped in this session (drives green markers + no re-pop).
  const [doneIds, setDoneIds] = useState<Set<string>>(
    () => new Set(questions.filter((q) => q.answered).map((q) => q.id)),
  );

  // Refs mirror state used inside the message handler (bound once per src).
  const lastTimeRef = useRef(0);
  const activeRef = useRef(false);
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

  // VideoFrame keys this component by src, so a lesson change remounts it and
  // all state starts fresh; the effect only needs to reset the shared store
  // and the crossing cursor (-1 so a question at t=0 satisfies `q.t > last`).
  useEffect(() => {
    setVideoTime(0);
    lastTimeRef.current = -1;
    activeRef.current = false;
    const iframe = ref.current;
    if (!iframe) return;

    const subscribe = () => {
      iframe.contentWindow?.postMessage(
        JSON.stringify({
          context: "player.js",
          version: "0.0.11",
          method: "addEventListener",
          value: "timeupdate",
          listener: "mezon-note-time",
        }),
        "*",
      );
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
      if (msg.event === "timeupdate" && typeof msg.value?.seconds === "number") {
        const now = msg.value.seconds;
        setVideoTime(now);
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
          setSelected(null);
          setResult(null);
          setFailed(false);
          setActive(hit);
        }
      }
    };

    window.addEventListener("message", onMessage);
    // The embed may already be past 'ready' by the time we mount — also try on load.
    iframe.addEventListener("load", subscribe);
    return () => {
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", subscribe);
    };
  }, [src]);

  function submit() {
    if (!active || selected == null) return;
    start(async () => {
      const res = await answerVideoQuestionAction(active.id, selected);
      if (res.ok) {
        setFailed(false);
        setResult({ correct: res.correct, correctIndex: res.correctIndex });
      } else {
        setFailed(true);
      }
    });
  }

  function closeQuestion() {
    if (active) {
      doneRef.current.add(active.id);
      setDoneIds((prev) => new Set(prev).add(active.id));
      // Rewind the crossing cursor to this question's time so a second
      // question inside the same timeupdate window still triggers next tick.
      lastTimeRef.current = active.t;
    }
    activeRef.current = false;
    setActive(null);
    post("play");
  }

  const dur = duration > 0 ? duration : initialDuration;

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          ref={ref}
          src={src}
          title={title}
          loading="lazy"
          allow="accelerated-2d-canvas; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />

        {active && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("vqLabel")}
            className="absolute inset-0 z-10 flex items-center justify-center bg-navy-900/85 p-4"
          >
            <div className="w-full max-w-lg rounded-xl bg-surface p-5 shadow-xl">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gold-500">
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
          </div>
        )}
      </div>

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
                onClick={() => post("setCurrentTime", Math.max(0, q.t - 1))}
                className={cn(
                  "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface",
                  doneIds.has(q.id) || q.answered ? "bg-success" : "bg-gold-500",
                )}
                style={{ left: `${Math.min(99.5, (q.t / dur) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ContentFormState } from "@/lib/content/actions";
import { lookupBunnyVideoAction } from "@/lib/video/actions";
import type { VideoLookupResult } from "@/lib/video";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field } from "./field";
import { FormError } from "@/components/auth/form-bits";

/** seconds → "4:32" or "1:04:32" */
function fmtDuration(total: number): string {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/**
 * Live Bunny video panel for the lesson editor: as a GUID is pasted it validates
 * it against the library, shows the thumbnail + encoding status, offers an inline
 * play-preview, and reports the real duration (auto-filled into the form). Purely
 * additive UX around the plain GUID input.
 */
function BunnyVideoPanel({
  info,
  checking,
  onDurationDetected,
}: {
  info: VideoLookupResult | null;
  checking: boolean;
  onDurationDetected: (seconds: number) => void;
}) {
  const t = useTranslations("Studio");
  // Transient preview state; reset per-video via a `key` on this component.
  const [showPlayer, setShowPlayer] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);

  if (checking) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-line bg-bg px-3 py-2 text-sm text-slate-500">
        <span className="size-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-navy-600" />
        {t("bunnyChecking")}
      </div>
    );
  }
  if (!info || info.state === "empty") return null;

  if (info.state === "not_configured") {
    return <StatusPill tone="muted">{t("bunnyNotConfigured")}</StatusPill>;
  }
  if (info.state === "not_found") {
    return <StatusPill tone="error">✕ {t("bunnyNotFound")}</StatusPill>;
  }
  if (info.state === "error") {
    return <StatusPill tone="error">✕ {t("bunnyError")}</StatusPill>;
  }

  // state === "ok"
  const ready = info.ready;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {ready ? (
          <StatusPill tone="success">
            ✓ {t("bunnyReady")}
            {info.durationSeconds > 0 && (
              <span className="ml-1 tabular-nums opacity-80">
                · {fmtDuration(info.durationSeconds)}
              </span>
            )}
          </StatusPill>
        ) : (
          <StatusPill tone="warn">⏳ {t("bunnyProcessing")}</StatusPill>
        )}
        {info.durationSeconds > 0 && (
          <button
            type="button"
            className="text-xs font-medium text-navy-600 underline-offset-2 hover:underline"
            onClick={() => onDurationDetected(info.durationSeconds)}
          >
            {t("bunnyUseDuration", { value: fmtDuration(info.durationSeconds) })}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-navy-900">
        {showPlayer ? (
          <div className="aspect-video w-full">
            <iframe
              src={info.embedUrl}
              title={info.title || "preview"}
              loading="lazy"
              allow="fullscreen; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => ready && setShowPlayer(true)}
            className="group relative block aspect-video w-full disabled:cursor-default"
            disabled={!ready}
            aria-label={t("bunnyPreview")}
          >
            {!thumbBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={info.thumbnailUrl}
                alt={info.title || ""}
                className="h-full w-full object-cover"
                onError={() => setThumbBroken(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-navy-100">
                {info.title || info.guid}
              </div>
            )}
            {ready && (
              <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/35">
                <span className="grid size-14 place-items-center rounded-full bg-white/90 text-navy-900 shadow-lg transition-transform group-hover:scale-105">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warn" | "error" | "muted";
  children: React.ReactNode;
}) {
  const toneClass = {
    success: "bg-success/10 text-success",
    warn: "bg-gold-100 text-ink",
    error: "bg-danger/10 text-danger",
    muted: "bg-line text-slate-500",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${toneClass}`}
    >
      {children}
    </span>
  );
}

type LessonLike = {
  title: { uz: string; ru?: string };
  body?: { uz: string; ru?: string } | null;
  bunnyVideoId?: string | null;
  durationSeconds?: number | null;
  isPreview: boolean;
};

const initial: ContentFormState = {};

/**
 * Lesson create/edit form. In "create" mode it resets and collapses on success;
 * in "edit" mode it stays open. `action` is a bound server action.
 */
export function LessonForm({
  action,
  lesson,
  mode,
  onDone,
}: {
  action: (prev: ContentFormState, fd: FormData) => Promise<ContentFormState>;
  lesson?: LessonLike;
  mode: "create" | "edit";
  onDone?: () => void;
}) {
  const t = useTranslations("Studio");
  const formRef = useRef<HTMLFormElement>(null);

  // Controlled so the Bunny panel can auto-fill duration and reset cleanly.
  const [guid, setGuid] = useState(lesson?.bunnyVideoId ?? "");
  const [duration, setDuration] = useState(
    lesson?.durationSeconds != null ? String(lesson.durationSeconds) : "",
  );
  const [videoInfo, setVideoInfo] = useState<VideoLookupResult | null>(null);
  const [checking, setChecking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Event-driven debounced lookup (not an effect): validates the pasted GUID,
  // pulls thumbnail/status, and auto-fills duration when the field is empty.
  function onGuidChange(next: string) {
    setGuid(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const g = next.trim();
    if (g.length < 32) {
      setVideoInfo(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      const res = await lookupBunnyVideoAction(g);
      setVideoInfo(res);
      setChecking(false);
      if (res.state === "ok" && res.durationSeconds > 0) {
        setDuration((d) => (d.trim() ? d : String(res.durationSeconds)));
      }
    }, 600);
  }

  // Edit mode: look up the already-saved video once on mount so its preview shows.
  useEffect(() => {
    const g = (lesson?.bunnyVideoId ?? "").trim();
    if (g.length < 32) return;
    let active = true;
    void lookupBunnyVideoAction(g).then((res) => {
      if (active) setVideoInfo(res);
    });
    return () => {
      active = false;
    };
    // Mount-only: intentionally not re-run when the prop identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, formAction, pending] = useActionState(
    async (prev: ContentFormState, fd: FormData) => {
      const res = await action(prev, fd);
      if (!res.fieldErrors && !res.error) {
        if (mode === "create") {
          formRef.current?.reset();
          setGuid("");
          setDuration("");
          setVideoInfo(null);
        }
        onDone?.();
      }
      return res;
    },
    initial,
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-lg border border-line bg-bg p-4">
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("titleUz")} errors={state.fieldErrors?.titleUz}>
          <Input name="titleUz" defaultValue={lesson?.title.uz} required />
        </Field>
        <Field label={t("titleRu")}>
          <Input name="titleRu" defaultValue={lesson?.title.ru ?? ""} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("bunnyVideoId")} hint={t("bunnyHint")}>
          <Input
            name="bunnyVideoId"
            value={guid}
            onChange={(e) => onGuidChange(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </Field>
        <Field label={t("durationSeconds")}>
          <Input
            name="durationSeconds"
            type="number"
            min={0}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="tabular-nums"
          />
        </Field>
      </div>

      <BunnyVideoPanel
        key={videoInfo?.state === "ok" ? videoInfo.guid : "none"}
        info={videoInfo}
        checking={checking}
        onDurationDetected={(s) => setDuration(String(s))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("lessonBodyUz")}>
          <Textarea name="bodyUz" rows={3} defaultValue={lesson?.body?.uz ?? ""} />
        </Field>
        <Field label={t("lessonBodyRu")}>
          <Textarea name="bodyRu" rows={3} defaultValue={lesson?.body?.ru ?? ""} />
        </Field>
      </div>

      <label className="flex items-center gap-3">
        <Switch name="isPreview" value="true" defaultChecked={lesson?.isPreview ?? false} />
        <span className="text-sm">{t("isPreview")}</span>
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {mode === "create" ? t("addLesson") : t("save")}
        </Button>
        {mode === "edit" && onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            {t("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Collapsible wrapper so an editor only renders when opened. */
export function Collapsible({
  trigger,
  children,
}: {
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger(open, () => setOpen((o) => !o))}
      {open && children(() => setOpen(false))}
    </>
  );
}

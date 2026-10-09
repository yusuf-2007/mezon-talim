"use client";

import { ArrowDown, ArrowUp, CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { lookupBunnyVideoAction } from "@/lib/video/actions";
import type { VideoLookupResult } from "@/lib/video";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./field";

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
    return <StatusPill tone="error"><XCircle className="size-3.5" /> {t("bunnyNotFound")}</StatusPill>;
  }
  if (info.state === "error") {
    return <StatusPill tone="error"><XCircle className="size-3.5" /> {t("bunnyError")}</StatusPill>;
  }

  // state === "ok"
  const ready = info.ready;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {ready ? (
          <StatusPill tone="success">
            <CheckCircle2 className="size-3.5" /> {t("bunnyReady")}
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


/** A saved part, as ModuleCard hands it to the editor. */
export type StudioLessonVideo = {
  id: string;
  bunnyVideoId: string;
  durationSeconds: number | null;
  titleUz: string;
  titleRu: string;
};

type Row = {
  /** React key; stable across reorders. */
  key: string;
  /** Saved part id — sent back so its notes/questions stay pinned to it. */
  id?: string;
  guid: string;
  duration: string;
  titleUz: string;
  titleRu: string;
};

let rowSeq = 0;
const newKey = () => `row-${++rowSeq}`;

function toRow(v: StudioLessonVideo): Row {
  return {
    key: v.id,
    id: v.id,
    guid: v.bunnyVideoId,
    duration: v.durationSeconds != null ? String(v.durationSeconds) : "",
    titleUz: v.titleUz,
    titleRu: v.titleRu,
  };
}

const emptyRow = (): Row => ({ key: newKey(), guid: "", duration: "", titleUz: "", titleRu: "" });

/**
 * The lesson's video parts (Part 1, Part 2 …). A short lesson keeps a single
 * part and looks like the old one-video field; a 2–3 hour lesson adds parts.
 * Every part gets the live Bunny check, preview and duration auto-fill.
 *
 * Submits as one hidden JSON field (`videos`) read by the lesson actions;
 * rows without a video ID are dropped. Saved parts carry their id so the
 * server updates them in place rather than recreating them.
 */
export function LessonVideosField({ initial = [] }: { initial?: StudioLessonVideo[] }) {
  const t = useTranslations("Studio");
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length > 0 ? initial.map(toRow) : [emptyRow()],
  );

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (index: number, dir: -1 | 1) =>
    setRows((rs) => {
      const next = [...rs];
      const [row] = next.splice(index, 1);
      next.splice(index + dir, 0, row);
      return next;
    });
  const remove = (key: string) =>
    setRows((rs) => (rs.length === 1 ? [emptyRow()] : rs.filter((r) => r.key !== key)));

  const payload = rows
    .filter((r) => r.guid.trim())
    .map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      bunnyVideoId: r.guid.trim(),
      durationSeconds: r.duration.trim() ? Number(r.duration) : null,
      titleUz: r.titleUz.trim() || undefined,
      titleRu: r.titleRu.trim() || undefined,
    }));
  const total = payload.reduce((sum, p) => sum + (p.durationSeconds ?? 0), 0);
  const multi = rows.length > 1;

  return (
    <fieldset className="space-y-3" data-testid="lesson-videos-field">
      <input type="hidden" name="videos" value={JSON.stringify(payload)} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <legend className="text-sm font-medium text-ink">{t("videosTitle")}</legend>
        {multi && total > 0 && (
          <span className="text-xs text-slate-500 tabular-nums">
            {t("videosTotal", { count: payload.length, duration: fmtDuration(total) })}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500">{t("videosHint")}</p>

      <ol className="space-y-3">
        {rows.map((row, i) => (
          <li key={row.key}>
            <VideoPartRow
              row={row}
              index={i}
              count={rows.length}
              multi={multi}
              onChange={(patch) => update(row.key, patch)}
              onMove={(dir) => move(i, dir)}
              onRemove={() => remove(row.key)}
            />
          </li>
        ))}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={rows.length >= 20}
        onClick={() => setRows((rs) => [...rs, emptyRow()])}
      >
        <Plus className="size-3.5" aria-hidden /> {t("videosAdd")}
      </Button>
    </fieldset>
  );
}

function VideoPartRow({
  row,
  index,
  count,
  multi,
  onChange,
  onMove,
  onRemove,
}: {
  row: Row;
  index: number;
  count: number;
  multi: boolean;
  onChange: (patch: Partial<Row>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("Studio");
  const [info, setInfo] = useState<VideoLookupResult | null>(null);
  const [checking, setChecking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = t("partN", { n: index + 1 });

  // Event-driven debounced lookup (not an effect): validates the pasted GUID,
  // pulls thumbnail/status, and auto-fills the duration when it is empty.
  function onGuidChange(next: string) {
    onChange({ guid: next });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const g = next.trim();
    if (g.length < 32) {
      setInfo(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      const res = await lookupBunnyVideoAction(g);
      setInfo(res);
      setChecking(false);
      if (res.state === "ok" && res.durationSeconds > 0 && !row.duration.trim()) {
        onChange({ duration: String(res.durationSeconds) });
      }
    }, 600);
  }

  // A saved part: look its video up once so the preview shows.
  useEffect(() => {
    const g = row.guid.trim();
    if (g.length < 32) return;
    let active = true;
    void lookupBunnyVideoAction(g).then((res) => {
      if (active) setInfo(res);
    });
    return () => {
      active = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Mount-only: later edits go through onGuidChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={multi ? "space-y-3 rounded-md border border-line bg-surface p-3" : "space-y-3"}
      data-testid="lesson-video-part"
    >
      {multi && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-navy-800">{label}</span>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label={t("videosMoveUp", { part: label })}>
              <ArrowUp className="size-3.5" aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={t("videosMoveDown", { part: label })}>
              <ArrowDown className="size-3.5" aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={t("videosRemove", { part: label })} className="text-danger hover:text-danger">
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={multi ? `${t("bunnyVideoId")} · ${label}` : t("bunnyVideoId")} hint={t("bunnyHint")}>
          <Input
            value={row.guid}
            onChange={(e) => onGuidChange(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            aria-label={`${t("bunnyVideoId")} · ${label}`}
          />
        </Field>
        <Field label={t("durationSeconds")}>
          <Input
            type="number"
            min={0}
            value={row.duration}
            onChange={(e) => onChange({ duration: e.target.value })}
            className="tabular-nums"
            aria-label={`${t("durationSeconds")} · ${label}`}
          />
        </Field>
      </div>

      {multi && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("partTitleUz")} hint={t("partTitleHint", { part: label })}>
            <Input value={row.titleUz} onChange={(e) => onChange({ titleUz: e.target.value })} maxLength={200} aria-label={`${t("partTitleUz")} · ${label}`} />
          </Field>
          <Field label={t("partTitleRu")}>
            <Input value={row.titleRu} onChange={(e) => onChange({ titleRu: e.target.value })} maxLength={200} aria-label={`${t("partTitleRu")} · ${label}`} />
          </Field>
        </div>
      )}

      <BunnyVideoPanel
        key={info?.state === "ok" ? info.guid : "none"}
        info={info}
        checking={checking}
        onDurationDetected={(s) => onChange({ duration: String(s) })}
      />
    </div>
  );
}

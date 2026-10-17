"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import type { AttachmentPageSize } from "@/lib/attachments/dto";

/**
 * What the lesson-materials viewers share: the slide store (fetch → decode →
 * ImageBitmap, never an object URL), painting a bitmap onto a <canvas>, and
 * small layout helpers. Used by the slide carousel (lesson-slides.tsx) and
 * the document reader (lesson-documents.tsx).
 */

/** Gold focus ring, the system's "invitation to act" (DESIGN.md › Inputs). */
export const FOCUS =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-lp-gold/50 focus-visible:ring-offset-1";

/** The flat panel that replaces a shielded slide. A token, so screenshots come out this gray. */
export const SHIELD_BG = "bg-lp-muted-light";

/**
 * Paints `bitmap` onto the returned canvas at device-pixel resolution,
 * contain-fitted. Repaints when the bitmap or shield changes, when the canvas
 * box changes (fullscreen, rotation, layout) and when the device pixel ratio
 * changes (zoom, another screen). While shielded the canvas stays cleared.
 */
export function useCanvasPaint(bitmap: ImageBitmap | null, shielded: boolean) {
  const ref = useRef<HTMLCanvasElement>(null);
  const draw = useEffectEvent(() => {
    if (ref.current) paint(ref.current, shielded ? null : bitmap);
  });

  useEffect(() => {
    draw();
  }, [bitmap, shielded]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);

    let query: MediaQueryList | null = null;
    const onDprChange = () => {
      draw();
      watch();
    };
    const watch = () => {
      query?.removeEventListener("change", onDprChange);
      query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      query.addEventListener("change", onDprChange);
    };
    watch();

    return () => {
      ro.disconnect();
      query?.removeEventListener("change", onDprChange);
    };
  }, []);

  return ref;
}

/** Size the backing store to the box × devicePixelRatio, clear, contain-fit the bitmap. */
function paint(canvas: HTMLCanvasElement, bitmap: ImageBitmap | null) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (!bitmap) return;
  const scale = Math.min(w / bitmap.width, h / bitmap.height);
  const dw = Math.round(bitmap.width * scale);
  const dh = Math.round(bitmap.height * scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  try {
    ctx.drawImage(bitmap, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
  } catch {
    // The bitmap was closed under us (deck switched mid-frame); the next
    // render brings a live one.
  }
}

/* ─── Slide store ─────────────────────────────────────────────────────────── */

class SlideHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

export type SlideEntry =
  | { state: "queued" }
  | { state: "loading"; controller: AbortController }
  | { state: "ready"; bitmap: ImageBitmap }
  | { state: "error"; status: number | null };

/**
 * Decoded slides for one deck, keyed by URL, with a small concurrency limit
 * (every view-only slide is watermarked on request, so the server does real
 * work per fetch). Fetches are `no-store` and go straight from the response
 * blob to an ImageBitmap — no object URL is ever created. Dropping an entry
 * aborts its fetch or closes its bitmap; `dispose` drops everything.
 */
export class SlideStore {
  private entries = new Map<string, SlideEntry>();
  private queue: string[] = [];
  private active = 0;
  private listeners = new Set<() => void>();
  private readonly concurrency: number;
  private readonly capacity: number;

  constructor({ concurrency, capacity = Infinity }: { concurrency: number; capacity?: number }) {
    this.concurrency = concurrency;
    this.capacity = capacity;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get(url: string): SlideEntry | undefined {
    return this.entries.get(url);
  }

  /** Load `url` unless it is already loaded, loading or failed (failures wait for retry). */
  request(url: string, { priority = false }: { priority?: boolean } = {}) {
    const existing = this.entries.get(url);
    if (existing) {
      // Most recently wanted moves to the end, so capacity evicts the stalest.
      this.entries.delete(url);
      this.entries.set(url, existing);
      if (priority && existing.state === "queued") {
        this.queue = [url, ...this.queue.filter((u) => u !== url)];
      }
      return;
    }
    this.entries.set(url, { state: "queued" });
    if (priority) this.queue.unshift(url);
    else this.queue.push(url);
    this.evict();
    this.pump();
    this.emit();
  }

  retry(url: string) {
    if (this.entries.get(url)?.state !== "error") return;
    this.entries.delete(url);
    this.request(url, { priority: true });
  }

  /** Drop every entry not in `keep`. */
  retain(keep: ReadonlySet<string>) {
    let changed = false;
    for (const [url, entry] of [...this.entries]) {
      if (keep.has(url)) continue;
      this.drop(url, entry);
      changed = true;
    }
    if (changed) this.emit();
  }

  /**
   * Nobody is waiting for `url` right now: abort its load, and forget a
   * failure so it is retried when wanted again. A loaded bitmap stays (the
   * capacity limit evicts it in time).
   */
  release(url: string) {
    const entry = this.entries.get(url);
    if (!entry || entry.state === "ready") return;
    this.drop(url, entry);
    this.emit();
  }

  dispose() {
    for (const [url, entry] of [...this.entries]) this.drop(url, entry);
    this.queue = [];
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private drop(url: string, entry: SlideEntry) {
    if (entry.state === "loading") entry.controller.abort();
    if (entry.state === "ready") entry.bitmap.close();
    this.entries.delete(url);
    if (entry.state === "queued") this.queue = this.queue.filter((u) => u !== url);
  }

  private evict() {
    if (this.entries.size <= this.capacity) return;
    for (const [url, entry] of [...this.entries]) {
      if (this.entries.size <= this.capacity) break;
      if (entry.state === "ready" || entry.state === "error") this.drop(url, entry);
    }
  }

  private pump() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const url = this.queue.shift()!;
      if (this.entries.get(url)?.state !== "queued") continue;
      const controller = new AbortController();
      this.entries.set(url, { state: "loading", controller });
      this.active += 1;
      void this.load(url, controller).finally(() => {
        this.active -= 1;
        this.pump();
      });
    }
  }

  private async load(url: string, controller: AbortController) {
    const stillWanted = () => {
      const entry = this.entries.get(url);
      return entry?.state === "loading" && entry.controller === controller;
    };
    try {
      const res = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new SlideHttpError(res.status);
      const bitmap = await createImageBitmap(await res.blob());
      if (!stillWanted()) {
        bitmap.close();
        return;
      }
      this.entries.set(url, { state: "ready", bitmap });
    } catch (err) {
      if (!stillWanted()) return; // aborted or dropped: nobody is listening
      this.entries.set(url, {
        state: "error",
        status: err instanceof SlideHttpError ? err.status : null,
      });
    }
    this.emit();
  }
}

const noEntry = () => undefined;

/** The store's entry for `url`, re-rendering when it changes. */
export function useStoreEntry(store: SlideStore, url: string): SlideEntry | undefined {
  return useSyncExternalStore(store.subscribe, () => store.get(url), noEntry);
}

/* ─── Small helpers ───────────────────────────────────────────────────────── */

export function pageSize(pages: AttachmentPageSize[], n: number): AttachmentPageSize {
  const p = pages[n - 1];
  return p && p.w > 0 && p.h > 0 ? p : { w: 16, h: 9 };
}

/** Very tall or very wide pages are letterboxed rather than given an extreme frame. */
export function clampRatio(r: number): number {
  return Math.min(Math.max(r, 0.5), 3);
}

const MB = 1024 * 1024;

export function useFormatBytes() {
  const locale = useLocale();
  return useMemo(() => {
    const mb = new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "megabyte",
      maximumFractionDigits: 1,
    });
    const kb = new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "kilobyte",
      maximumFractionDigits: 0,
    });
    return (bytes: number) =>
      bytes >= MB ? mb.format(bytes / MB) : kb.format(Math.max(1, Math.round(bytes / 1024)));
  }, [locale]);
}

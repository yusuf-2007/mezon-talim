"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  Lock,
  Maximize2,
  Minimize2,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  attachmentPageUrl,
  type AttachmentPageSize,
  type LessonSlideDeck,
} from "@/lib/attachments/dto";
import { Eyebrow } from "@/components/learn/flow-ui";
import { cn } from "@/lib/utils";
import { useSlideShield } from "./use-slide-shield";

type T = ReturnType<typeof useTranslations<"Player">>;

/** Gold focus ring, the system's "invitation to act" (DESIGN.md › Inputs). */
const FOCUS =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-lp-gold/50 focus-visible:ring-offset-1";

/** The flat panel that replaces a shielded slide. A token, so screenshots come out this gray. */
const SHIELD_BG = "bg-lp-muted-light";

/** A swipe must travel this far, mostly sideways, to turn the slide. */
const SWIPE_PX = 40;

/**
 * Lesson materials under the video: each ready attachment is a deck of slides
 * the student pages through. Slides are fetched from /api/attachments/*,
 * decoded into ImageBitmaps and painted onto <canvas> — never an <img> and
 * never an object URL, so there is no element or URL to "save image as".
 *
 * View-only decks (the teacher left downloads off) also run useSlideShield:
 * the slides blank to a gray panel when a capture is likely, and right-click,
 * drag, copy, print and save are refused. That is deterrence, not DRM — see
 * the hook. Every view-only slide also carries the viewer's watermark, burned
 * in by the server. Downloadable decks get a Download button instead.
 */
export function LessonSlides({ decks }: { decks: LessonSlideDeck[] }) {
  if (decks.length === 0) return null;
  return <SlidesViewer decks={decks} />;
}

function SlidesViewer({ decks }: { decks: LessonSlideDeck[] }) {
  const t = useTranslations("Player");
  const formatBytes = useFormatBytes();
  const titleId = useId();
  const rootRef = useRef<HTMLElement>(null);

  const [deckIndex, setDeckIndex] = useState(0);
  // Remember where the student was in each deck when switching between them.
  const [pageByDeck, setPageByDeck] = useState<Record<string, number>>({});

  const deck = decks[Math.min(deckIndex, decks.length - 1)];
  const total = Math.max(1, deck.pageCount);
  const page = Math.min(Math.max(1, pageByDeck[deck.id] ?? 1), total);
  const viewOnly = !deck.allowDownload;

  const shielded = useSlideShield(rootRef, viewOnly);
  const fullscreen = useFullscreen(rootRef);

  const goTo = useCallback(
    (n: number) => {
      const next = Math.min(Math.max(1, n), total);
      setPageByDeck((prev) => (prev[deck.id] === next ? prev : { ...prev, [deck.id]: next }));
    },
    [deck.id, total],
  );

  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable='true']")) return;
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
        goTo(page + 1);
        break;
      case "ArrowLeft":
      case "PageUp":
        goTo(page - 1);
        break;
      case "Home":
        goTo(1);
        break;
      case "End":
        goTo(total);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <>
      <section
        ref={rootRef}
        aria-labelledby={titleId}
        data-testid="lesson-slides"
        data-deck-id={deck.id}
        data-view-only={viewOnly ? "true" : "false"}
        onKeyDown={onKeyDown}
        className={cn(
          "overflow-hidden border border-lp-line bg-white",
          fullscreen.active ? "flex h-full w-full flex-col border-0" : "rounded-[14px]",
          // View-only: nothing to select, no iOS long-press "Save image", never printed.
          viewOnly && "select-none [-webkit-touch-callout:none] print:hidden",
        )}
      >
        <header className="px-[18px] pb-4 pt-[18px] sm:px-[22px]">
          <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
            {/* The basis makes the controls wrap below on phones instead of
                squeezing the title to nothing. */}
            <div className="min-w-0 flex-[1_1_14rem]">
              <Eyebrow>{t("slidesTitle")}</Eyebrow>
              <h2
                id={titleId}
                title={deck.title}
                data-testid="slides-title"
                className="mt-1.5 truncate font-lp-heading text-[1.2rem] font-semibold leading-snug text-lp-navy"
              >
                {deck.title}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2.5 sm:gap-2">
              <p
                aria-live="polite"
                aria-atomic="true"
                data-testid="slides-counter"
                className="text-[.82rem] font-semibold text-lp-slate tabular-nums sm:min-w-[3.5rem] sm:px-1 sm:text-right"
              >
                {t("slidesCounter", { current: page, total })}
              </p>
              {fullscreen.supported && (
                <button
                  type="button"
                  onClick={fullscreen.toggle}
                  aria-label={fullscreen.active ? t("slidesExitFullscreen") : t("slidesFullscreen")}
                  title={fullscreen.active ? t("slidesExitFullscreen") : t("slidesFullscreen")}
                  data-testid="slides-fullscreen"
                  className={cn(
                    "grid size-9 place-items-center rounded-[9px] border-[1.5px] border-lp-line bg-white text-lp-navy transition-colors hover:bg-lp-wash",
                    FOCUS,
                  )}
                >
                  {fullscreen.active ? (
                    <Minimize2 aria-hidden className="size-4" />
                  ) : (
                    <Maximize2 aria-hidden className="size-4" />
                  )}
                </button>
              )}
              {deck.download && (
                <a
                  href={deck.download.url}
                  data-testid="slides-download"
                  title={t("slidesDownloadLabel", {
                    fileName: deck.download.fileName,
                    size: formatBytes(deck.download.sizeBytes),
                  })}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-[9px] border-[1.5px] border-lp-navy bg-white px-3.5 text-[.82rem] font-bold text-lp-navy transition-colors hover:bg-lp-wash",
                    FOCUS,
                  )}
                >
                  <Download aria-hidden className="size-4" />
                  {t("slidesDownload")}
                  <span className="font-semibold text-lp-muted tabular-nums">
                    {formatBytes(deck.download.sizeBytes)}
                  </span>
                </a>
              )}
            </div>
          </div>

          {decks.length > 1 && (
            <div
              role="group"
              aria-label={t("slidesDecks")}
              className="-mx-1 mt-3.5 flex gap-2 overflow-x-auto px-1 py-1"
            >
              {decks.map((d, i) => {
                const active = d.id === deck.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={active}
                    data-testid="slides-deck-chip"
                    onClick={() => setDeckIndex(i)}
                    className={cn(
                      "max-w-[16rem] shrink-0 truncate rounded-full px-3.5 py-1.5 text-[.82rem] font-semibold transition-colors",
                      active
                        ? "bg-lp-navy text-white"
                        : "bg-lp-tint text-lp-navy hover:bg-lp-line-strong",
                      FOCUS,
                    )}
                  >
                    {d.title}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* Keyed: switching decks drops the old deck's fetches and bitmaps. */}
        <DeckViewer
          key={deck.id}
          deck={deck}
          page={page}
          total={total}
          onPage={goTo}
          shielded={shielded}
          fullscreen={fullscreen.active}
          t={t}
        />

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-lp-line-soft px-[18px] py-3 text-[.8rem] text-lp-muted sm:px-[22px]">
          {viewOnly ? (
            <p data-testid="slides-view-only-note" className="inline-flex items-center gap-1.5">
              <Lock aria-hidden className="size-3.5 shrink-0" strokeWidth={2.25} />
              {t("slidesViewOnly")}
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5">
              <Download aria-hidden className="size-3.5 shrink-0" strokeWidth={2.25} />
              {t("slidesDownloadable")}
            </p>
          )}
          {total > 1 && <p className="hidden md:block">{t("slidesKeysHint")}</p>}
        </div>
      </section>

      {viewOnly && (
        <p
          data-testid="slides-print-disabled"
          className="hidden rounded-[14px] border border-lp-line px-[22px] py-4 text-[.85rem] text-lp-slate print:block"
        >
          {t("slidesPrintDisabled")}
        </p>
      )}
    </>
  );
}

/* ─── One deck: the stage and its thumbnail strip ─────────────────────────── */

function DeckViewer({
  deck,
  page,
  total,
  onPage,
  shielded,
  fullscreen,
  t,
}: {
  deck: LessonSlideDeck;
  page: number;
  total: number;
  onPage: (n: number) => void;
  shielded: boolean;
  fullscreen: boolean;
  t: T;
}) {
  // Two stores per deck: full slides (current ± 1) and thumbnails (LRU).
  const [slides] = useState(() => new SlideStore({ concurrency: 2 }));
  const [thumbs] = useState(() => new SlideStore({ concurrency: 3, capacity: 60 }));
  useEffect(
    () => () => {
      slides.dispose();
      thumbs.dispose();
    },
    [slides, thumbs],
  );

  const src = attachmentPageUrl(deck.id, page);
  const entry = useStoreEntry(slides, src);
  const ready = entry?.state === "ready";

  // Keep the neighbours, drop (abort / close) everything else, load this one first.
  useEffect(() => {
    const keep = new Set([attachmentPageUrl(deck.id, page)]);
    if (page > 1) keep.add(attachmentPageUrl(deck.id, page - 1));
    if (page < total) keep.add(attachmentPageUrl(deck.id, page + 1));
    slides.retain(keep);
    slides.request(attachmentPageUrl(deck.id, page), { priority: true });
  }, [slides, deck.id, page, total]);

  // Prefetch the next slide once this one is on screen.
  useEffect(() => {
    if (ready && page < total) slides.request(attachmentPageUrl(deck.id, page + 1));
  }, [slides, ready, deck.id, page, total]);

  const size = pageSize(deck.pages, page);
  const ratio = clampRatio(size.w / size.h);
  const state = shielded ? "shielded" : (entry?.state ?? "loading");
  const label = t("slidesSlideLabel", { title: deck.title, current: page, total });

  // Touch swipe. touch-action: pan-y keeps vertical scrolling native while the
  // horizontal gesture reaches us.
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse") return;
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    onPage(dx < 0 ? page + 1 : page - 1);
  };

  return (
    <>
      <div
        className={cn(
          "relative",
          fullscreen
            ? "flex min-h-0 flex-1 items-center justify-center bg-lp-navy-deep"
            : "border-y border-lp-line bg-lp-wash px-3 py-4 sm:px-16 sm:py-6",
        )}
      >
        <div
          tabIndex={0}
          role="group"
          aria-label={t("slidesViewer", { title: deck.title })}
          data-testid="slides-stage"
          data-state={state}
          data-page={page}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipe.current = null;
          }}
          className={cn(
            "relative mx-auto touch-pan-y touch-pinch-zoom overflow-hidden",
            fullscreen
              ? "size-full"
              : "rounded-[6px] bg-white shadow-[0_2px_10px_rgb(2_58_105/0.08)]",
            FOCUS,
          )}
          // Reserve the slide's shape before it arrives: no layout shift. The
          // height is capped so a portrait page never pushes the lesson away.
          style={
            fullscreen
              ? undefined
              : { aspectRatio: `${ratio}`, width: `min(100%, calc(min(70vh, 720px) * ${ratio}))` }
          }
        >
          <SlideCanvas
            bitmap={entry?.state === "ready" ? entry.bitmap : null}
            shielded={shielded}
            label={label}
            page={page}
            state={state}
          />

          {!shielded && (entry === undefined || entry.state === "queued" || entry.state === "loading") && (
            <div className="absolute inset-0 grid place-items-center" role="status">
              <LoaderCircle
                aria-hidden
                className={cn(
                  "size-6 animate-spin motion-reduce:animate-none",
                  fullscreen ? "text-lp-on-navy-dim" : "text-lp-muted-light",
                )}
              />
              <span className="sr-only">{t("slidesLoading")}</span>
            </div>
          )}

          {!shielded && entry?.state === "error" && (
            <div
              role="alert"
              data-testid="slides-error"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-lp-wash-alt px-6 text-center"
            >
              <TriangleAlert aria-hidden className="size-6 text-lp-danger" strokeWidth={1.75} />
              <p className="max-w-[36ch] text-[.85rem] text-lp-slate">
                {entry.status === 401
                  ? t("slidesErrorSession")
                  : entry.status === 429
                    ? t("slidesErrorBusy")
                    : t("slidesError")}
              </p>
              <button
                type="button"
                data-testid="slides-retry"
                onClick={() => slides.retry(src)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[9px] border-[1.5px] border-lp-line bg-white px-3.5 py-2 text-[.82rem] font-bold text-lp-navy transition-colors hover:bg-lp-wash",
                  FOCUS,
                )}
              >
                <RotateCw aria-hidden className="size-3.5" />
                {t("slidesRetry")}
              </button>
            </div>
          )}

          {shielded && (
            <div
              data-testid="slides-shield"
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-lp-navy-deep",
                SHIELD_BG,
              )}
            >
              <span className="grid size-11 place-items-center rounded-full bg-white/70">
                <Lock aria-hidden className="size-5" strokeWidth={2} />
              </span>
              <p className="text-[.9rem] font-semibold">{t("slidesProtected")}</p>
            </div>
          )}
        </div>

        {total > 1 && (
          <>
            <StageButton
              side="left"
              label={t("slidesPrev")}
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
            />
            <StageButton
              side="right"
              label={t("slidesNext")}
              disabled={page >= total}
              onClick={() => onPage(page + 1)}
            />
          </>
        )}
      </div>

      {total > 1 && (
        <ThumbStrip
          deck={deck}
          page={page}
          total={total}
          onPage={onPage}
          store={thumbs}
          shielded={shielded}
          t={t}
        />
      )}
    </>
  );
}

function StageButton({
  side,
  label,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  // aria-disabled rather than disabled: a disabled button drops focus, and the
  // arrow keys only work while focus is inside the viewer.
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      data-testid={side === "left" ? "slides-prev" : "slides-next"}
      className={cn(
        // On phones the buttons sit over the slide itself, so a dead one is
        // hidden there rather than dimmed over the content.
        "absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-lp-line bg-white/95 text-lp-navy shadow-[0_6px_24px_rgb(2_58_105/0.09)] transition-[opacity,background-color] hover:bg-white aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:bg-white/95 max-sm:aria-disabled:opacity-0 sm:size-10",
        side === "left" ? "left-2 sm:left-3" : "right-2 sm:right-3",
        FOCUS,
      )}
    >
      <Icon aria-hidden className="size-5" strokeWidth={2} />
    </button>
  );
}

/* ─── Canvas painting ─────────────────────────────────────────────────────── */

/** The current slide. Accessible name: deck title and position. */
function SlideCanvas({
  bitmap,
  shielded,
  label,
  page,
  state,
}: {
  bitmap: ImageBitmap | null;
  shielded: boolean;
  label: string;
  page: number;
  state: string;
}) {
  const ref = useCanvasPaint(bitmap, shielded);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      data-testid="slides-canvas"
      data-page={page}
      data-state={state}
      className="absolute inset-0 block size-full"
    />
  );
}

/**
 * Paints `bitmap` onto the returned canvas at device-pixel resolution,
 * contain-fitted. Repaints when the bitmap or shield changes, when the canvas
 * box changes (fullscreen, rotation, layout) and when the device pixel ratio
 * changes (zoom, another screen). While shielded the canvas stays cleared.
 */
function useCanvasPaint(bitmap: ImageBitmap | null, shielded: boolean) {
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

/* ─── Thumbnails ──────────────────────────────────────────────────────────── */

const THUMB_HEIGHT = 54;

function ThumbStrip({
  deck,
  page,
  total,
  onPage,
  store,
  shielded,
  t,
}: {
  deck: LessonSlideDeck;
  page: number;
  total: number;
  onPage: (n: number) => void;
  store: SlideStore;
  shielded: boolean;
  t: T;
}) {
  const stripRef = useRef<HTMLOListElement>(null);
  const [visible, setVisible] = useState<ReadonlySet<number>>(() => new Set());

  // Lazy: a thumbnail loads when it scrolls within ~4 thumbs of the strip's view.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const io = new IntersectionObserver(
      (records) => {
        setVisible((prev) => {
          const next = new Set(prev);
          for (const r of records) {
            const n = Number((r.target as HTMLElement).dataset.page);
            if (r.isIntersecting) next.add(n);
            else next.delete(n);
          }
          return next;
        });
      },
      { root: strip, rootMargin: "0px 400px" },
    );
    for (const el of strip.querySelectorAll<HTMLElement>("[data-page]")) io.observe(el);
    return () => io.disconnect();
  }, [total]);

  // Keep the current slide's thumbnail in view.
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.querySelector<HTMLElement>(`[data-page="${page}"]`);
    if (!strip || !el) return;
    const left = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, [page]);

  const numbers = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);

  return (
    <nav aria-label={t("slidesThumbs")} className="px-[18px] pt-3 sm:px-[22px]">
      <ol ref={stripRef} className="relative flex gap-2 overflow-x-auto px-0.5 pb-3 pt-0.5">
        {numbers.map((n) => (
          <li key={n} className="shrink-0">
            <Thumb
              src={attachmentPageUrl(deck.id, n, true)}
              n={n}
              size={pageSize(deck.pages, n)}
              current={n === page}
              visible={visible.has(n)}
              shielded={shielded}
              store={store}
              label={t("slidesGoTo", { page: n })}
              onSelect={() => onPage(n)}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Thumb({
  src,
  n,
  size,
  current,
  visible,
  shielded,
  store,
  label,
  onSelect,
}: {
  src: string;
  n: number;
  size: AttachmentPageSize;
  current: boolean;
  visible: boolean;
  shielded: boolean;
  store: SlideStore;
  label: string;
  onSelect: () => void;
}) {
  const entry = useStoreEntry(store, src);
  const ref = useCanvasPaint(entry?.state === "ready" ? entry.bitmap : null, shielded);

  useEffect(() => {
    if (visible) store.request(src);
    else store.release(src); // scrolled away: abort, or forget a failure so it retries
  }, [store, src, visible]);

  const ratio = Math.min(Math.max(size.w / size.h, 0.6), 2.2);

  return (
    <button
      type="button"
      data-page={n}
      data-testid="slides-thumb"
      aria-label={label}
      aria-current={current ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "relative block overflow-hidden rounded-[6px] border bg-white transition-shadow",
        current
          ? "border-lp-navy shadow-[0_0_0_1.5px_var(--color-lp-navy)]"
          : "border-lp-line opacity-80 hover:opacity-100",
        FOCUS,
      )}
      style={{ height: THUMB_HEIGHT, width: Math.round(THUMB_HEIGHT * ratio) }}
    >
      <canvas ref={ref} aria-hidden className="absolute inset-0 block size-full" />
      {shielded && <span aria-hidden className={cn("absolute inset-0", SHIELD_BG)} />}
      {entry?.state === "error" && !shielded && (
        <TriangleAlert
          aria-hidden
          className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-lp-muted"
        />
      )}
      <span
        aria-hidden
        className={cn(
          "absolute bottom-1 right-1 rounded-[4px] px-1 text-[.66rem] font-bold leading-[1.4] tabular-nums",
          current ? "bg-lp-navy text-white" : "bg-white/90 text-lp-navy",
        )}
      >
        {n}
      </span>
    </button>
  );
}

/* ─── Slide store ─────────────────────────────────────────────────────────── */

class SlideHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

type SlideEntry =
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
class SlideStore {
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
function useStoreEntry(store: SlideStore, url: string): SlideEntry | undefined {
  return useSyncExternalStore(store.subscribe, () => store.get(url), noEntry);
}

/* ─── Small helpers ───────────────────────────────────────────────────────── */

function pageSize(pages: AttachmentPageSize[], n: number): AttachmentPageSize {
  const p = pages[n - 1];
  return p && p.w > 0 && p.h > 0 ? p : { w: 16, h: 9 };
}

/** Very tall or very wide pages are letterboxed rather than given an extreme frame. */
function clampRatio(r: number): number {
  return Math.min(Math.max(r, 0.5), 3);
}

const noopSubscribe = () => () => {};

function useFullscreen(ref: RefObject<HTMLElement | null>) {
  // Unsupported on iPhone Safari: the button is simply not offered there.
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => document.fullscreenEnabled === true,
    () => false,
  );
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const el = document.fullscreenElement;
      setActive(el !== null && el === ref.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [ref]);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void ref.current?.requestFullscreen().catch(() => {});
  }, [ref]);

  return { supported, active, toggle };
}

const MB = 1024 * 1024;

function useFormatBytes() {
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

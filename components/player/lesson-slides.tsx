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
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useTranslations } from "next-intl";
import {
  attachmentPageUrl,
  type AttachmentPageSize,
  type LessonSlideDeck,
} from "@/lib/attachments/dto";
import { Eyebrow } from "@/components/learn/flow-ui";
import { cn } from "@/lib/utils";
import { LessonDocuments } from "./lesson-documents";
import {
  FOCUS,
  SHIELD_BG,
  SlideStore,
  clampRatio,
  pageSize,
  useCanvasPaint,
  useFormatBytes,
  useStoreEntry,
} from "./slide-canvas";
import { useSlideShield } from "./use-slide-shield";

type T = ReturnType<typeof useTranslations<"Player">>;

/** A swipe must travel this far, mostly sideways, to turn the slide. */
const SWIPE_PX = 40;
/** A short, quick swipe (a flick) turns the slide even if it travelled little. */
const FLICK_MS = 250;
/** Movement before a press becomes a drag (or is left to the page as a scroll). */
const DRAG_START_PX = 6;
/** Space between slides on the track, seen while dragging. */
const PANE_GAP_PX = 16;

/**
 * Lesson materials under the video, by role. Lecture slides are a carousel
 * the student swipes through; documents (terminology, further reading) are
 * cards that open a scrolling reader (lesson-documents.tsx).
 *
 * Slides are fetched from /api/attachments/*, decoded into ImageBitmaps and
 * painted onto <canvas> — never an <img> and never an object URL, so there is
 * no element or URL to "save image as".
 *
 * View-only decks (the teacher left downloads off) also run useSlideShield:
 * the slides blank to a gray panel when a capture is likely, and right-click,
 * drag, copy, print and save are refused. That is deterrence, not DRM — see
 * the hook. Every view-only slide also carries the viewer's watermark, burned
 * in by the server. Downloadable decks get a Download button instead.
 */
export function LessonSlides({ decks }: { decks: LessonSlideDeck[] }) {
  const slideDecks = decks.filter((d) => d.role === "slides");
  const documents = decks.filter((d) => d.role === "document");
  if (slideDecks.length === 0 && documents.length === 0) return null;
  return (
    <div className="space-y-4">
      {slideDecks.length > 0 && <SlidesViewer decks={slideDecks} />}
      {documents.length > 0 && <LessonDocuments documents={documents} />}
    </div>
  );
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

  // Once this slide is on screen, load both neighbours: each is one swipe away
  // and already peeks in while the student drags.
  useEffect(() => {
    if (!ready) return;
    if (page < total) slides.request(attachmentPageUrl(deck.id, page + 1));
    if (page > 1) slides.request(attachmentPageUrl(deck.id, page - 1));
  }, [slides, ready, deck.id, page, total]);

  const size = pageSize(deck.pages, page);
  const ratio = clampRatio(size.w / size.h);
  const state = shielded ? "shielded" : (entry?.state ?? "loading");
  const label = t("slidesSlideLabel", { title: deck.title, current: page, total });

  // ── Carousel ──
  // The slides sit side by side on a track; the track follows the finger (or
  // the mouse) while dragging, then slides to the chosen slide. Only the
  // current slide and its two neighbours are mounted.
  const stageRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ id: number; x: number; y: number; at: number; axis: "x" | "y" | null } | null>(
    null,
  );
  // Slide between neighbours; a jump (thumbnail, Home/End) cuts straight to
  // the slide instead of racing past blank ones.
  const [shown, setShown] = useState({ page, jump: false });
  if (shown.page !== page) setShown({ page, jump: Math.abs(page - shown.page) > 1 });

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (total < 2 || (e.pointerType === "mouse" && e.button !== 0)) return;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, at: e.timeStamp, axis: null };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.axis === null) {
      if (Math.abs(dx) < DRAG_START_PX && Math.abs(dy) < DRAG_START_PX) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (g.axis === "y") return; // a scroll: the page has it
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    if (g.axis !== "x") return;
    // Past the first or last slide the track gives a little, then resists.
    const pastEdge = (dx > 0 && page <= 1) || (dx < 0 && page >= total);
    setDrag(pastEdge ? dx / 4 : dx);
  };
  const endGesture = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (g.axis !== "x") return;
    setDragging(false);
    setDrag(0);
    if (cancelled) return;
    const dx = e.clientX - g.x;
    const width = stageRef.current?.clientWidth ?? 0;
    const far = Math.abs(dx) >= Math.max(SWIPE_PX, Math.min(width * 0.2, 96));
    const flick = Math.abs(dx) >= SWIPE_PX && e.timeStamp - g.at < FLICK_MS;
    if (far || flick) onPage(dx < 0 ? page + 1 : page - 1);
  };

  const panes = [page - 1, page, page + 1].filter((n) => n >= 1 && n <= total);
  const offset = (n: number) => `calc(${(n - 1) * 100}% + ${(n - 1) * PANE_GAP_PX}px)`;

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
          ref={stageRef}
          tabIndex={0}
          role="group"
          aria-roledescription={t("slidesCarousel")}
          aria-label={t("slidesViewer", { title: deck.title })}
          data-testid="slides-stage"
          data-state={state}
          data-page={page}
          data-dragging={dragging ? "true" : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endGesture(e, false)}
          onPointerCancel={(e) => endGesture(e, true)}
          className={cn(
            "relative mx-auto touch-pan-y touch-pinch-zoom select-none overflow-hidden",
            total > 1 && (dragging ? "cursor-grabbing" : "cursor-grab"),
            fullscreen ? "size-full" : "rounded-[6px] shadow-[0_2px_10px_rgb(2_58_105/0.08)]",
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
          <div
            data-testid="slides-track"
            className={cn(
              "absolute inset-0 will-change-transform",
              dragging || shown.jump
                ? "transition-none"
                : "transition-transform duration-300 ease-[cubic-bezier(.22,.8,.24,1)] motion-reduce:transition-none",
            )}
            style={{
              transform: `translate3d(calc(${-(page - 1) * 100}% - ${(page - 1) * PANE_GAP_PX}px + ${drag}px), 0, 0)`,
            }}
          >
            {panes.map((n) => (
              <div
                key={n}
                className={cn("absolute inset-y-0 w-full", !fullscreen && "bg-white")}
                style={{ left: offset(n) }}
              >
                <SlidePane
                  store={slides}
                  src={attachmentPageUrl(deck.id, n)}
                  n={n}
                  current={n === page}
                  shielded={shielded}
                  label={label}
                  state={state}
                />
              </div>
            ))}
          </div>

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

/**
 * One slide on the carousel track. The current one is the accessible image
 * (deck title and position); the neighbours peeking in are decoration.
 */
function SlidePane({
  store,
  src,
  n,
  current,
  shielded,
  label,
  state,
}: {
  store: SlideStore;
  src: string;
  n: number;
  current: boolean;
  shielded: boolean;
  label: string;
  state: string;
}) {
  const entry = useStoreEntry(store, src);
  const ref = useCanvasPaint(entry?.state === "ready" ? entry.bitmap : null, shielded);
  return (
    <canvas
      ref={ref}
      role={current ? "img" : undefined}
      aria-label={current ? label : undefined}
      aria-hidden={current ? undefined : true}
      data-testid={current ? "slides-canvas" : "slides-canvas-peek"}
      data-page={n}
      data-state={current ? state : undefined}
      className="absolute inset-0 block size-full"
    />
  );
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

/* ─── Small helpers ───────────────────────────────────────────────────────── */

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


"use client";

import { ChevronRight, Download, FileText, LoaderCircle, Lock, RotateCw, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { attachmentPageUrl, type LessonSlideDeck } from "@/lib/attachments/dto";
import { Eyebrow } from "@/components/learn/flow-ui";
import { cn } from "@/lib/utils";
import {
  FOCUS,
  SHIELD_BG,
  SlideStore,
  pageSize,
  useCanvasPaint,
  useFormatBytes,
  useStoreEntry,
} from "./slide-canvas";
import { useSlideShield } from "./use-slide-shield";

type T = ReturnType<typeof useTranslations<"Player">>;

/** Pages within this distance of the reader's view are loaded ahead of the scroll. */
const PRELOAD_MARGIN = "900px 0px";

/**
 * A lesson's documents — terminology lists, further reading: PDFs meant to be
 * read top to bottom rather than paged like slides. Each is a card; opening
 * one shows a reader that scrolls through its pages.
 *
 * Same protection as the slides: pages are watermarked by the server, painted
 * onto <canvas> (never an <img> or object URL), and view-only documents run
 * the slide shield, in the card list (first-page previews) and in the reader.
 */
export function LessonDocuments({ documents }: { documents: LessonSlideDeck[] }) {
  const t = useTranslations("Player");
  const rootRef = useRef<HTMLElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = documents.find((d) => d.id === openId) ?? null;
  const anyViewOnly = documents.some((d) => !d.allowDownload);
  const shielded = useSlideShield(rootRef, anyViewOnly && open === null);
  // First-page previews for the cards, shared across them.
  const [previews] = useState(() => new SlideStore({ concurrency: 2 }));
  useEffect(() => () => previews.dispose(), [previews]);

  return (
    <section
      ref={rootRef}
      aria-label={t("docsTitle")}
      data-testid="lesson-documents"
      className={cn(
        "rounded-[14px] border border-lp-line bg-white px-[18px] py-[18px] sm:px-[22px]",
        anyViewOnly && "select-none [-webkit-touch-callout:none] print:hidden",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>{t("docsTitle")}</Eyebrow>
        <p className="text-[.8rem] font-semibold text-lp-muted tabular-nums">
          {t("docsCount", { count: documents.length })}
        </p>
      </div>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            previews={previews}
            shielded={shielded && !doc.allowDownload}
            onOpen={() => setOpenId(doc.id)}
            t={t}
          />
        ))}
      </ul>
      {open && <DocumentReader key={open.id} doc={open} onClose={() => setOpenId(null)} t={t} />}
    </section>
  );
}

function DocumentCard({
  doc,
  previews,
  shielded,
  onOpen,
  t,
}: {
  doc: LessonSlideDeck;
  previews: SlideStore;
  shielded: boolean;
  onOpen: () => void;
  t: T;
}) {
  const formatBytes = useFormatBytes();
  const src = attachmentPageUrl(doc.id, 1, true);
  const entry = useStoreEntry(previews, src);
  const canvasRef = useCanvasPaint(entry?.state === "ready" ? entry.bitmap : null, shielded);
  useEffect(() => previews.request(src), [previews, src]);
  const first = pageSize(doc.pages, 1);
  const meta = [
    t("docsPages", { count: Math.max(1, doc.pageCount) }),
    doc.kind === "pdf" ? "PDF" : null,
    doc.download ? formatBytes(doc.download.sizeBytes) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      data-testid="document-card"
      data-document-id={doc.id}
      className="group relative flex items-center gap-3.5 rounded-[12px] border border-lp-line bg-white p-2.5 pr-3 transition-colors hover:border-lp-line-strong hover:bg-lp-wash"
    >
      {/* A small first-page preview; the icon shows until it arrives. */}
      <div
        className="relative grid h-[64px] shrink-0 place-items-center overflow-hidden rounded-[6px] border border-lp-line bg-lp-wash"
        style={{ aspectRatio: `${Math.min(Math.max(first.w / first.h, 0.6), 1.4)}` }}
      >
        <FileText aria-hidden className="size-5 text-lp-muted" strokeWidth={1.75} />
        <canvas
          ref={canvasRef}
          aria-hidden
          className={cn("absolute inset-0 block size-full bg-white", entry?.state !== "ready" && "opacity-0")}
        />
        {shielded && <span aria-hidden className={cn("absolute inset-0", SHIELD_BG)} />}
      </div>

      <div className="min-w-0 flex-1">
        {/* The whole card opens the document (the button stretches over it). */}
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("docsOpenLabel", { title: doc.title })}
          data-testid="document-open"
          className={cn(
            "line-clamp-2 text-left text-[.95rem] font-semibold leading-snug text-lp-navy after:absolute after:inset-0 after:rounded-[12px] after:content-['']",
            FOCUS,
          )}
        >
          {doc.title}
        </button>
        <p className="mt-1 flex items-center gap-1.5 text-[.8rem] text-lp-muted tabular-nums">
          {!doc.allowDownload && <Lock aria-hidden className="size-3 shrink-0" strokeWidth={2.25} />}
          {meta}
        </p>
      </div>

      {doc.download ? (
        <a
          href={doc.download.url}
          data-testid="document-download"
          aria-label={t("slidesDownloadLabel", {
            fileName: doc.download.fileName,
            size: formatBytes(doc.download.sizeBytes),
          })}
          title={t("slidesDownload")}
          className={cn(
            "relative z-10 grid size-9 shrink-0 place-items-center rounded-[9px] border-[1.5px] border-lp-line bg-white text-lp-navy transition-colors hover:bg-lp-tint",
            FOCUS,
          )}
        >
          <Download aria-hidden className="size-4" />
        </a>
      ) : (
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-lp-muted transition-transform group-hover:translate-x-0.5"
        />
      )}
    </li>
  );
}

/**
 * The reader: a modal dialog (full screen on phones, a large panel on wider
 * screens) with the document's pages stacked for scrolling. Pages load as they
 * come within reach of the view and are released once far away.
 */
function DocumentReader({ doc, onClose, t }: { doc: LessonSlideDeck; onClose: () => void; t: T }) {
  const formatBytes = useFormatBytes();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewOnly = !doc.allowDownload;
  const shielded = useSlideShield(rootRef, viewOnly);
  const total = Math.max(1, doc.pageCount);
  const [current, setCurrent] = useState(1);
  const [visible, setVisible] = useState<ReadonlySet<number>>(() => new Set([1, 2]));
  const [store] = useState(() => new SlideStore({ concurrency: 2, capacity: 10 }));
  useEffect(() => () => store.dispose(), [store]);

  // Open as a modal before paint; closing (Esc, the X) hands back to the list.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    scrollRef.current?.focus();
  }, []);

  // Which pages are near the view (load those) and which one is being read.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const near = new IntersectionObserver(
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
      { root: scroller, rootMargin: PRELOAD_MARGIN },
    );
    const pages = [...scroller.querySelectorAll<HTMLElement>("[data-page]")];
    for (const el of pages) near.observe(el);

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // The page crossing a line a third of the way down the view.
        const line = scroller.scrollTop + scroller.clientHeight / 3;
        let n = 1;
        for (const el of pages) if (el.offsetTop <= line) n = Number(el.dataset.page);
        setCurrent(n);
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      near.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [total]);

  const numbers = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      data-testid="document-reader"
      data-document-id={doc.id}
      data-view-only={viewOnly ? "true" : "false"}
      className={cn(
        "m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-lp-wash p-0 text-lp-navy backdrop:bg-lp-navy-deep/70",
        "sm:m-auto sm:h-[calc(100dvh-48px)] sm:w-[min(960px,calc(100%-48px))] sm:rounded-[14px] sm:shadow-[0_24px_60px_rgb(1_20_40/0.35)]",
        viewOnly && "select-none [-webkit-touch-callout:none] print:hidden",
      )}
    >
      <div ref={rootRef} className="flex h-full flex-col">
        <header className="flex items-center gap-3 border-b border-lp-line bg-white px-4 py-3 sm:px-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-lp-tint text-lp-navy">
            <FileText aria-hidden className="size-[18px]" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              title={doc.title}
              className="truncate font-lp-heading text-[1.1rem] font-semibold leading-snug text-lp-navy"
            >
              {doc.title}
            </h2>
            <p
              aria-live="polite"
              data-testid="document-counter"
              className="text-[.78rem] font-semibold text-lp-muted tabular-nums"
            >
              {t("docsPageOf", { current, total })}
            </p>
          </div>
          {doc.download && (
            <a
              href={doc.download.url}
              aria-label={t("slidesDownloadLabel", {
                fileName: doc.download.fileName,
                size: formatBytes(doc.download.sizeBytes),
              })}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-[9px] border-[1.5px] border-lp-navy bg-white px-3 text-[.82rem] font-bold text-lp-navy transition-colors hover:bg-lp-wash",
                FOCUS,
              )}
            >
              <Download aria-hidden className="size-4" />
              <span className="max-sm:sr-only">{t("slidesDownload")}</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t("docsClose")}
            title={t("docsClose")}
            data-testid="document-close"
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-[9px] border-[1.5px] border-lp-line bg-white text-lp-navy transition-colors hover:bg-lp-wash",
              FOCUS,
            )}
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            tabIndex={0}
            aria-label={t("docsReader", { title: doc.title })}
            data-testid="document-pages"
            className="relative h-full overflow-y-auto overscroll-contain outline-none"
          >
            <ol className="mx-auto flex max-w-[820px] flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
              {numbers.map((n) => (
                <DocumentPage
                  key={n}
                  doc={doc}
                  n={n}
                  total={total}
                  near={visible.has(n)}
                  store={store}
                  shielded={shielded}
                  t={t}
                />
              ))}
            </ol>
          </div>
          {shielded && (
            <div
              data-testid="document-shield"
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

        <footer className="flex items-center gap-1.5 border-t border-lp-line bg-white px-4 py-2.5 text-[.8rem] text-lp-muted sm:px-5">
          {viewOnly ? (
            <>
              <Lock aria-hidden className="size-3.5 shrink-0" strokeWidth={2.25} />
              {t("slidesViewOnly")}
            </>
          ) : (
            <>
              <Download aria-hidden className="size-3.5 shrink-0" strokeWidth={2.25} />
              {t("slidesDownloadable")}
            </>
          )}
        </footer>
      </div>
    </dialog>
  );
}

function DocumentPage({
  doc,
  n,
  total,
  near,
  store,
  shielded,
  t,
}: {
  doc: LessonSlideDeck;
  n: number;
  total: number;
  near: boolean;
  store: SlideStore;
  shielded: boolean;
  t: T;
}) {
  const src = attachmentPageUrl(doc.id, n);
  const entry = useStoreEntry(store, src);
  const canvasRef = useCanvasPaint(entry?.state === "ready" ? entry.bitmap : null, shielded);
  const size = pageSize(doc.pages, n);

  useEffect(() => {
    if (near) store.request(src);
    else store.release(src); // scrolled far away: abort, or forget a failure so it retries
  }, [store, src, near]);

  const state = shielded ? "shielded" : (entry?.state ?? "idle");

  return (
    <li
      data-page={n}
      data-testid="document-page"
      data-state={state}
      className="relative w-full overflow-hidden rounded-[4px] bg-white shadow-[0_2px_10px_rgb(2_58_105/0.08)]"
      // Reserve every page's shape up front, so the scroll never jumps.
      style={{ aspectRatio: `${size.w / size.h}` }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={t("docsPageLabel", { title: doc.title, current: n, total })}
        className="absolute inset-0 block size-full"
      />
      {!shielded && (entry?.state === "queued" || entry?.state === "loading") && (
        <div className="absolute inset-0 grid place-items-center" role="status">
          <LoaderCircle aria-hidden className="size-6 animate-spin text-lp-muted-light motion-reduce:animate-none" />
          <span className="sr-only">{t("slidesLoading")}</span>
        </div>
      )}
      {!shielded && entry?.state === "error" && (
        <div
          role="alert"
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
            onClick={() => store.retry(src)}
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
    </li>
  );
}

"use client";

import { useEffect, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

/** How long the shield stays up after the last trigger clears (focus back, keys released). */
const RELEASE_MS = 400;
/** One-shot triggers (PrintScreen, Ctrl/Cmd+P/S) hold the shield this long. */
const FLASH_MS = 1200;
/** While focus is inside the lesson video, how often to check the browser window still has it. */
const FRAME_POLL_MS = 250;
/**
 * The lesson's Bunny player (components/player/video-embed.tsx). Focus moving
 * into it is the student using the video, not leaving the page.
 */
const VIDEO_FRAME = "iframe[data-lesson-video]";

type ModifierState = Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey">;

/**
 * Screenshot and copy deterrence for a VIEW-ONLY slide deck.
 *
 * Read this before trusting it: a web page cannot stop a screenshot. Phone
 * cameras, OS capture tools that never notify the page (macOS Cmd+Shift+3/4/5
 * fires no event once the keys are pressed, the Windows Snipping Tool, screen
 * recorders) and the browser's own devtools all get past it. What it does is
 * blank the slides in the moments a capture is most likely (the window losing
 * focus, the tab hiding, the screenshot shortcuts' modifier keys going down,
 * PrintScreen, printing) and refuse the casual routes (right-click → save,
 * drag-out, copy, Ctrl/Cmd+P and Ctrl/Cmd+S). The real protection is that every
 * view-only slide is served with the viewer's name, id, masked contact and the
 * time burned into its pixels, so anything that does leak is traceable.
 *
 * While shielded, every <canvas> inside `rootRef` is cleared (not merely
 * covered), synchronously at the trigger, so a capture that fires at that
 * instant gets an empty canvas rather than a slide under an overlay. The
 * caller redraws when this returns false again.
 *
 * Clicking into the lesson video (a cross-origin iframe on the same page)
 * blurs this window too; that alone does not shield. While focus is in the
 * video the page hears no keys and no further blur, so it polls
 * document.hasFocus() to still notice the browser window losing focus. The
 * screenshot shortcuts pressed while focus is in the video stay invisible —
 * an accepted gap of a deterrent.
 *
 * Only active while `enabled` (the deck on screen is view-only). Downloadable
 * decks get none of it.
 */
export function useSlideShield(rootRef: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [shielded, setShielded] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return;

    const holds = {
      blurred: false,
      hidden: false,
      combo: false,
      printing: false,
      flash: false,
    };
    let releaseTimer: number | undefined;
    let flashTimer: number | undefined;
    let blurCheck: number | undefined;
    let framePoll: number | undefined;
    let disposed = false;
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

    const clearCanvases = () => {
      for (const canvas of root.querySelectorAll("canvas")) {
        canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    const held = () =>
      holds.blurred || holds.hidden || holds.combo || holds.printing || holds.flash;

    /** `immediate`: drop the shield now rather than after RELEASE_MS. */
    const sync = ({ immediate = false }: { immediate?: boolean } = {}) => {
      window.clearTimeout(releaseTimer);
      if (held()) {
        clearCanvases();
        // Paint the gray panel now, not on the next frame: the trigger is the
        // moment a capture is most likely to be taken.
        flushSync(() => setShielded(true));
      } else if (immediate) {
        setShielded(false);
      } else {
        releaseTimer = window.setTimeout(() => setShielded(false), RELEASE_MS);
      }
    };

    const inVideoFrame = () => {
      const el = document.activeElement;
      return el instanceof HTMLIFrameElement && el.matches(VIDEO_FRAME);
    };
    /** Focus moved into the lesson video and the browser window still has it. */
    const stillOnPage = () => inVideoFrame() && document.hasFocus();

    const stopFramePoll = () => {
      window.clearInterval(framePoll);
      framePoll = undefined;
    };
    /**
     * While the video holds focus, the window already counts as blurred, so
     * switching apps fires nothing here. hasFocus() still tells: it stays true
     * while a child frame has focus and turns false once the browser window
     * loses it.
     */
    const watchFrameFocus = () => {
      if (framePoll !== undefined) return;
      framePoll = window.setInterval(() => {
        if (!inVideoFrame()) {
          stopFramePoll();
          // Focus went from the video into some other frame: an ordinary blur.
          // (Back to the page itself, the window's focus event takes over.)
          if (document.activeElement instanceof HTMLIFrameElement && !holds.blurred) {
            holds.blurred = true;
            sync();
          }
          return;
        }
        const away = !document.hasFocus();
        if (away !== holds.blurred) {
          holds.blurred = away;
          sync();
        }
      }, FRAME_POLL_MS);
    };

    const flash = () => {
      holds.flash = true;
      sync();
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => {
        holds.flash = false;
        sync();
      }, FLASH_MS);
    };

    // PrintScreen on Windows copies the screen to the clipboard; overwrite it.
    // Usually refused (needs focus and permission) — a best effort, never an error.
    const scrubClipboard = () => {
      try {
        void navigator.clipboard?.writeText("").catch(() => {});
      } catch {
        // Clipboard API unavailable.
      }
    };

    /**
     * The screenshot shortcuts' modifiers: Cmd+Shift (macOS 3/4/5, with or
     * without Ctrl), Ctrl+Shift, and on Windows/Linux the Windows key alone
     * (Win+Shift+S, Win+PrtSc, Game Bar). Recomputed from every key and pointer
     * event, so releasing either key lowers the hold.
     */
    const comboHeld = (e: ModifierState) =>
      ((e.metaKey || e.ctrlKey) && e.shiftKey) || (!isMac && e.metaKey);

    // Physical key first, so non-Latin layouts (Cyrillic) still match. Chrome's
    // autofill dispatches key events without a `key`, hence the guard.
    const isKey = (e: KeyboardEvent, letter: "p" | "s") =>
      e.code === `Key${letter.toUpperCase()}` ||
      (typeof e.key === "string" && e.key.toLowerCase() === letter);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        scrubClipboard();
        flash();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (isKey(e, "p") || isKey(e, "s"))) {
        // Print and "Save page as" would hand over the slides wholesale.
        e.preventDefault();
        e.stopPropagation();
        flash();
        return;
      }
      const combo = comboHeld(e);
      if (combo !== holds.combo) {
        holds.combo = combo;
        sync();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      // Windows browsers usually only see PrintScreen's keyup.
      if (e.key === "PrintScreen") {
        scrubClipboard();
        flash();
        return;
      }
      const combo = comboHeld(e);
      if (combo !== holds.combo) {
        holds.combo = combo;
        sync();
      }
    };

    /**
     * A screenshot shortcut can swallow the modifiers' keyup (macOS
     * Cmd+Shift+4 hands the keyboard to the capture tool without blurring the
     * window), which would leave the combo hold up until some later key. The
     * page gets no pointer events while the capture tool is up; the first one
     * afterwards carries the real modifier state, so re-read it there.
     */
    const onPointer = (e: PointerEvent) => {
      const combo = comboHeld(e);
      if (combo !== holds.combo) {
        holds.combo = combo;
        sync();
      }
    };

    const onBlur = () => {
      window.clearTimeout(blurCheck);
      // Some engines already report the video as activeElement here.
      if (stillOnPage()) {
        watchFrameFocus();
        return;
      }
      holds.blurred = true;
      sync();
      // Others move activeElement after the event: look again next tick, and
      // lift the shield at once if it was only the video taking focus.
      blurCheck = window.setTimeout(() => {
        if (!stillOnPage()) return;
        holds.blurred = false;
        sync({ immediate: true });
        watchFrameFocus();
      }, 0);
    };
    const onFocus = () => {
      window.clearTimeout(blurCheck);
      stopFramePoll();
      holds.blurred = false;
      // Keys released while the window was away never sent a keyup.
      holds.combo = false;
      sync();
    };
    const onVisibility = () => {
      holds.hidden = document.visibilityState === "hidden";
      sync();
    };
    const onBeforePrint = () => {
      holds.printing = true;
      sync();
    };
    const onAfterPrint = () => {
      holds.printing = false;
      sync();
    };

    // The casual routes, on the viewer only: save-image menus, drag-out,
    // selection and copy.
    const block = (e: Event) => e.preventDefault();

    // The window may already be unfocused or hidden as this mounts (the
    // student switched away while the page loaded): no blur event will come,
    // so start from the current state. hasFocus() counts focus inside a
    // child frame as the page's, so focus already in the video is fine.
    holds.hidden = document.visibilityState === "hidden";
    holds.blurred = !document.hasFocus();
    if (inVideoFrame()) watchFrameFocus();
    if (held()) {
      clearCanvases();
      // Not from the effect body itself: sync() uses flushSync.
      queueMicrotask(() => {
        if (!disposed) sync();
      });
    }

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("pointermove", onPointer, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    document.addEventListener("visibilitychange", onVisibility);
    root.addEventListener("contextmenu", block);
    root.addEventListener("dragstart", block);
    root.addEventListener("selectstart", block);
    root.addEventListener("copy", block);
    root.addEventListener("cut", block);

    return () => {
      disposed = true;
      window.clearTimeout(releaseTimer);
      window.clearTimeout(flashTimer);
      window.clearTimeout(blurCheck);
      stopFramePoll();
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("pointermove", onPointer, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("contextmenu", block);
      root.removeEventListener("dragstart", block);
      root.removeEventListener("selectstart", block);
      root.removeEventListener("copy", block);
      root.removeEventListener("cut", block);
      setShielded(false);
    };
  }, [rootRef, enabled]);

  return enabled && shielded;
}

"use client";

import { useEffect, useRef } from "react";
import { setVideoTime } from "./video-time-store";

/**
 * Client wrapper around the Bunny Stream iframe. Bunny's embed speaks the
 * player.js postMessage protocol, so we subscribe to `timeupdate` and mirror
 * the playhead into the shared video-time store — that's what powers the
 * "use current video time" checkbox on the note form.
 */
export function VideoEmbed({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setVideoTime(0);
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
        value?: { seconds?: number };
      };
      if (msg?.context !== "player.js") return;
      if (msg.event === "ready") subscribe();
      if (msg.event === "timeupdate" && typeof msg.value?.seconds === "number") {
        setVideoTime(msg.value.seconds);
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

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      loading="lazy"
      allow="accelerated-2d-canvas; fullscreen; picture-in-picture"
      allowFullScreen
      className="h-full w-full border-0"
    />
  );
}

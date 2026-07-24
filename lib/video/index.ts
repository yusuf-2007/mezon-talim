import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Bunny.net Stream integration — the only place playback tokens are minted and
 * the one media type allowed off-shore (non-personal content). Playback is
 * view-only with token auth, no downloads (CLAUDE.md §1, B6).
 *
 * When Bunny env vars are absent (local dev before an account exists), the
 * helpers degrade gracefully: `isVideoConfigured()` reports false and the Studio
 * falls back to manual GUID entry; signing returns an unsigned embed URL.
 */
export interface SignedPlayback {
  /** Embed/iframe URL with a signed, expiring token (or unsigned in dev). */
  url: string;
  /** Direct HLS playlist URL (also token-gated in production). */
  hlsUrl: string;
  thumbnailUrl: string;
  expiresAt: number; // unix seconds
}

export interface PlaybackOptions {
  /** Token lifetime in seconds (short-lived). */
  ttlSeconds?: number;
}

export function isVideoConfigured(): boolean {
  return Boolean(env.BUNNY_STREAM_LIBRARY_ID && env.BUNNY_STREAM_CDN_HOSTNAME);
}

/**
 * Bunny's token auth: SHA-256 over (authKey + path + expires), hex, passed as
 * `token`/`expires` query params. We sign the iframe embed path.
 * See https://docs.bunny.net/docs/stream-embed-token-authentication
 */
function signPath(path: string, expires: number): string {
  return createHash("sha256")
    .update(`${env.BUNNY_TOKEN_AUTH_KEY ?? ""}${path}${expires}`)
    .digest("hex");
}

export function signPlaybackToken(
  bunnyVideoId: string,
  opts: PlaybackOptions = {},
): SignedPlayback {
  const libraryId = env.BUNNY_STREAM_LIBRARY_ID;
  const cdn = env.BUNNY_STREAM_CDN_HOSTNAME;
  const ttl = opts.ttlSeconds ?? 60 * 60 * 4; // 4h default
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;

  // Dev fallback: no library configured → return a best-effort embed URL.
  if (!libraryId || !cdn) {
    return {
      url: `https://iframe.mediadelivery.net/embed/0/${bunnyVideoId}`,
      hlsUrl: "",
      thumbnailUrl: "",
      expiresAt,
    };
  }

  const embedPath = `/embed/${libraryId}/${bunnyVideoId}`;
  const hlsBase = `https://${cdn}/${bunnyVideoId}`;

  if (!env.BUNNY_TOKEN_AUTH_KEY) {
    // Library configured but token auth disabled — unsigned embed.
    return {
      url: `https://iframe.mediadelivery.net${embedPath}`,
      hlsUrl: `${hlsBase}/playlist.m3u8`,
      thumbnailUrl: `${hlsBase}/thumbnail.jpg`,
      expiresAt,
    };
  }

  const token = signPath(embedPath, expiresAt);
  return {
    url: `https://iframe.mediadelivery.net${embedPath}?token=${token}&expires=${expiresAt}`,
    hlsUrl: `${hlsBase}/playlist.m3u8`,
    thumbnailUrl: `${hlsBase}/thumbnail.jpg`,
    expiresAt,
  };
}

// ── Stream management API (server-side, used by the Studio) ──────────────────

const BUNNY_API = "https://video.bunnycdn.com";

export interface CreatedBunnyVideo {
  guid: string;
  /** TUS/PUT upload endpoint the Studio uses to push the file. */
  uploadUrl: string;
}

/**
 * Create a video placeholder in the Bunny library and return its GUID + upload
 * URL. Throws if Bunny isn't configured — callers in dev should branch on
 * `isVideoConfigured()` and accept a manual GUID instead.
 */
export async function createBunnyVideo(
  title: string,
): Promise<CreatedBunnyVideo> {
  const libraryId = env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) {
    throw new Error("Bunny Stream is not configured (BUNNY_STREAM_*).");
  }

  const res = await fetch(`${BUNNY_API}/library/${libraryId}/videos`, {
    method: "POST",
    headers: {
      AccessKey: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Bunny create video failed: ${res.status}`);
  const json = (await res.json()) as { guid: string };
  return {
    guid: json.guid,
    uploadUrl: `${BUNNY_API}/library/${libraryId}/videos/${json.guid}`,
  };
}

/** True when the management API can be called (library + API key present). */
export function isBunnyManagementConfigured(): boolean {
  return Boolean(env.BUNNY_STREAM_LIBRARY_ID && env.BUNNY_STREAM_API_KEY);
}

/**
 * Sync Bunny "moments" for a video — the embed player renders each as a small
 * dot ON ITS OWN SEEK BAR (the only supported way to mark up the cross-origin
 * player's timeline). Used to mirror in-video question timestamps. Replaces
 * the video's whole moments list; best-effort — a Bunny hiccup must never
 * break question authoring (the in-app marker strip still works without it).
 */
export async function syncVideoMoments(
  videoId: string,
  moments: { label: string; timestamp: number }[],
): Promise<boolean> {
  const libraryId = env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey || !videoId) return false;
  try {
    const res = await fetch(`${BUNNY_API}/library/${libraryId}/videos/${videoId}`, {
      method: "POST",
      headers: {
        AccessKey: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ moments }),
    });
    if (!res.ok) console.error(`Bunny moments sync failed: ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error("Bunny moments sync failed:", err);
    return false;
  }
}

/** Deterministic thumbnail URL for a video (works from the CDN host alone). */
export function bunnyThumbnailUrl(guid: string, file = "thumbnail.jpg"): string {
  const cdn = env.BUNNY_STREAM_CDN_HOSTNAME;
  return cdn ? `https://${cdn}/${guid}/${file}` : "";
}

/** Unsigned embed URL — fine for the authenticated Studio preview. */
export function bunnyEmbedUrl(guid: string): string {
  const lib = env.BUNNY_STREAM_LIBRARY_ID ?? "0";
  return `https://iframe.mediadelivery.net/embed/${lib}/${guid}`;
}

export type BunnyVideoStatus =
  | "created"
  | "uploaded"
  | "processing"
  | "transcoding"
  | "finished"
  | "error"
  | "failed"
  | "unknown";

// Bunny Stream numeric status codes → our labels.
const STATUS_MAP: Record<number, BunnyVideoStatus> = {
  0: "created",
  1: "uploaded",
  2: "processing",
  3: "transcoding",
  4: "finished",
  5: "error",
  6: "failed",
};

export interface BunnyVideoInfo {
  guid: string;
  title: string;
  durationSeconds: number;
  status: BunnyVideoStatus;
  ready: boolean; // playable (encoding finished)
  thumbnailUrl: string;
  embedUrl: string;
}

/**
 * Fetch one video's metadata from the Bunny library (Studio helper): validates a
 * pasted GUID and reads duration + encoding status + thumbnail. Returns null when
 * the GUID doesn't exist (404); throws only on unexpected API failures.
 */
export async function getBunnyVideo(
  guid: string,
): Promise<BunnyVideoInfo | null> {
  const libraryId = env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) {
    throw new Error("Bunny Stream is not configured (BUNNY_STREAM_*).");
  }

  const res = await fetch(
    `${BUNNY_API}/library/${libraryId}/videos/${encodeURIComponent(guid)}`,
    { headers: { AccessKey: apiKey, Accept: "application/json" }, cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Bunny get video failed: ${res.status}`);

  const v = (await res.json()) as {
    guid: string;
    title?: string;
    length?: number;
    status?: number;
    thumbnailFileName?: string;
  };
  const status = STATUS_MAP[v.status ?? -1] ?? "unknown";
  return {
    guid: v.guid,
    title: v.title ?? "",
    durationSeconds: v.length ?? 0,
    status,
    ready: status === "finished",
    thumbnailUrl: bunnyThumbnailUrl(v.guid, v.thumbnailFileName || "thumbnail.jpg"),
    embedUrl: bunnyEmbedUrl(v.guid),
  };
}

/** Serializable result of a Studio GUID lookup (shared by the server action + form). */
export type VideoLookupResult =
  | { state: "not_configured" }
  | { state: "empty" }
  | { state: "not_found" }
  | { state: "error"; message: string }
  | {
      state: "ok";
      guid: string;
      title: string;
      durationSeconds: number;
      status: BunnyVideoStatus;
      ready: boolean;
      thumbnailUrl: string;
      embedUrl: string;
    };

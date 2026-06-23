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

import "server-only";

/**
 * Bunny.net Stream integration — the only place playback tokens are minted.
 * Video is the one media type allowed off-shore (non-personal content);
 * playback is view-only with token auth + DRM, no downloads (CLAUDE.md §1, B6).
 *
 * Phase 3 implements signing against BUNNY_TOKEN_AUTH_KEY; Phase 1 is the
 * typed contract only.
 */
export interface SignedPlayback {
  /** Embed/iframe URL with a signed, expiring token. */
  url: string;
  expiresAt: number; // unix seconds
}

export interface PlaybackOptions {
  /** Token lifetime in seconds (short-lived; default set in Phase 3). */
  ttlSeconds?: number;
  /** Bind the token to the viewer's IP when available. */
  viewerIp?: string;
}

const NOT_IMPLEMENTED =
  "lib/video: Bunny token signing not implemented until Phase 3.";

export function signPlaybackToken(
  _bunnyVideoId: string,
  _opts?: PlaybackOptions,
): SignedPlayback {
  // TODO(phase-3): HMAC-sign the path with BUNNY_TOKEN_AUTH_KEY + expiry.
  throw new Error(NOT_IMPLEMENTED);
}

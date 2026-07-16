"use server";

import { requireRole } from "@/lib/auth";
import {
  getBunnyVideo,
  isBunnyManagementConfigured,
  type VideoLookupResult,
} from "./index";

/**
 * Studio-only lookup of a pasted Bunny GUID — powers the lesson editor's live
 * thumbnail/status preview + duration auto-fill + validation (tiers 1–3).
 * Content editors only. Returns a serializable, never-throwing result so the
 * client can render every state cleanly.
 */
export async function lookupBunnyVideoAction(
  rawGuid: string,
): Promise<VideoLookupResult> {
  await requireRole("teacher", "super_admin");

  const guid = rawGuid.trim();
  if (!guid) return { state: "empty" };
  if (!isBunnyManagementConfigured()) return { state: "not_configured" };

  try {
    const info = await getBunnyVideo(guid);
    if (!info) return { state: "not_found" };
    return { state: "ok", ...info };
  } catch (e) {
    return {
      state: "error",
      message: e instanceof Error ? e.message : "lookup failed",
    };
  }
}

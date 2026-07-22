import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import { appSettings } from "../schema";

/**
 * Admin-tunable app settings (key-value). The swap boundary for anything an
 * admin can toggle without a redeploy. Read/write only through here.
 */

/** Visual treatment of the anonymous entry poll — admin-selectable. */
export const POLL_VARIANTS = ["corner", "modal_blur", "modal_clear"] as const;
export type PollVariant = (typeof POLL_VARIANTS)[number];

export const POLL_VARIANT_KEY = "audience.poll_variant";
export const DEFAULT_POLL_VARIANT: PollVariant = "modal_clear";

function isPollVariant(v: unknown): v is PollVariant {
  return typeof v === "string" && (POLL_VARIANTS as readonly string[]).includes(v);
}

export const settingsRepository = {
  /** Raw setting value, or null if unset. */
  async get<T = unknown>(key: string): Promise<T | null> {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);
    return row ? (row.value as T) : null;
  },

  /** Upsert a setting value (records who changed it). */
  async set(key: string, value: unknown, updatedByUserId: string | null): Promise<void> {
    await db
      .insert(appSettings)
      .values({ key, value, updatedByUserId })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedByUserId, updatedAt: sql`now()` },
      });
  },

  /** Active entry-poll variant, falling back to the default when unset/invalid. */
  async getPollVariant(): Promise<PollVariant> {
    const raw = await this.get(POLL_VARIANT_KEY);
    return isPollVariant(raw) ? raw : DEFAULT_POLL_VARIANT;
  },

  async setPollVariant(variant: PollVariant, updatedByUserId: string | null): Promise<void> {
    await this.set(POLL_VARIANT_KEY, variant, updatedByUserId);
  },
};

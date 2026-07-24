import "server-only";
import { lt, sql } from "drizzle-orm";
import { db } from "../client";
import { rateLimits } from "../schema";

/**
 * Fixed-window counters backing lib/rate-limit. One atomic upsert per hit:
 * expired window → reset to 1, live window → increment. The caller compares
 * the returned count against its limit.
 */
export const rateLimitsRepository = {
  async hit(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; windowStart: Date }> {
    const secs = windowMs / 1000;
    const [row] = await db
      .insert(rateLimits)
      .values({ key, windowStart: sql`now()`, count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${rateLimits.windowStart} <= now() - make_interval(secs => ${secs}) then 1 else ${rateLimits.count} + 1 end`,
          windowStart: sql`case when ${rateLimits.windowStart} <= now() - make_interval(secs => ${secs}) then now() else ${rateLimits.windowStart} end`,
        },
      })
      .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });
    return row;
  },

  /** Drop counters whose window ended over a day ago (opportunistic sweep). */
  async sweep(): Promise<void> {
    await db
      .delete(rateLimits)
      .where(lt(rateLimits.windowStart, sql`now() - interval '1 day'`));
  },
};

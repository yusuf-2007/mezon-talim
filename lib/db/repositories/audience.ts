import "server-only";
import { and, count, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "../client";
import { audienceSignals, users } from "../schema";

export type OccupationValue =
  | "student"
  | "business_owner"
  | "corporate_employee"
  | "educator"
  | "other";

export type OccupationBreakdown = { occupation: OccupationValue; count: number }[];

/**
 * Audience analytics: the anonymous entry-poll signals and the registrant
 * occupations. Kept anonymous — signals never join to a user.
 */
export const audienceRepository = {
  /** Record one anonymous poll response (occupation null = skipped). */
  async record(input: {
    visitorId: string;
    occupation: OccupationValue | null;
    landingPath?: string | null;
    referrer?: string | null;
    locale?: string | null;
  }) {
    await db.insert(audienceSignals).values({
      visitorId: input.visitorId,
      occupation: input.occupation,
      landingPath: input.landingPath ?? null,
      referrer: input.referrer ?? null,
      locale: input.locale ?? null,
    });
  },

  /** True if this browser's visitor id already answered/skipped (server guard). */
  async hasResponded(visitorId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: audienceSignals.id })
      .from(audienceSignals)
      .where(sql`${audienceSignals.visitorId} = ${visitorId}`)
      .limit(1);
    return Boolean(row);
  },

  /** Occupation breakdown of anonymous visitors who answered the poll. */
  async visitorBreakdown(): Promise<OccupationBreakdown> {
    const rows = await db
      .select({
        occupation: audienceSignals.occupation,
        count: count(),
      })
      .from(audienceSignals)
      .where(isNotNull(audienceSignals.occupation))
      .groupBy(audienceSignals.occupation);
    return rows as OccupationBreakdown;
  },

  /** Poll totals: answered vs skipped (for the response-rate figure). */
  async pollTotals(): Promise<{ answered: number; skipped: number }> {
    const [row] = await db
      .select({
        answered: sql<number>`count(*) filter (where ${audienceSignals.occupation} is not null)::int`,
        skipped: sql<number>`count(*) filter (where ${audienceSignals.occupation} is null)::int`,
      })
      .from(audienceSignals);
    return { answered: row?.answered ?? 0, skipped: row?.skipped ?? 0 };
  },

  /** Occupation breakdown of registered users (who filled it at signup). */
  async registrantBreakdown(): Promise<OccupationBreakdown> {
    const rows = await db
      .select({
        occupation: users.occupation,
        count: count(),
      })
      .from(users)
      .where(isNotNull(users.occupation))
      .groupBy(users.occupation);
    return rows as OccupationBreakdown;
  },

  /** New anonymous signals in the last N days (activity figure). */
  async signalsSince(days: number): Promise<number> {
    const since = sql`now() - (${days} || ' days')::interval`;
    const [row] = await db
      .select({ n: count() })
      .from(audienceSignals)
      .where(and(gte(audienceSignals.createdAt, since), isNotNull(audienceSignals.occupation)));
    return row?.n ?? 0;
  },
};

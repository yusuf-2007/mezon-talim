import "server-only";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { phoneOtps } from "../schema";

/**
 * Phone OTP repository. Codes are stored hashed; a code is single-use (marked
 * consumed) and time-boxed. Used by the Eskiz-gated phone login flow.
 */
export const phoneOtpsRepository = {
  async create(phone: string, codeHash: string, expiresAt: Date) {
    const [row] = await db
      .insert(phoneOtps)
      .values({ phone, codeHash, expiresAt })
      .returning();
    return row;
  },

  /** Most recent unconsumed, unexpired OTP for a phone. */
  async findActive(phone: string) {
    const [row] = await db
      .select()
      .from(phoneOtps)
      .where(
        and(
          eq(phoneOtps.phone, phone),
          isNull(phoneOtps.consumedAt),
          gt(phoneOtps.expiresAt, sql`now()`),
        ),
      )
      .orderBy(desc(phoneOtps.createdAt))
      .limit(1);
    return row ?? null;
  },

  async markConsumed(id: string) {
    await db
      .update(phoneOtps)
      .set({ consumedAt: sql`now()` })
      .where(eq(phoneOtps.id, id));
  },
};

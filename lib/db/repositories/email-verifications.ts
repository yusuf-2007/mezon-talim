import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { emailVerifications } from "../schema";

/**
 * Pending email-address claims. Tokens are stored hashed — only the raw token
 * travels in the link — and are single-use (marked consumed) and time-boxed.
 */
export const emailVerificationsRepository = {
  async create(userId: string, email: string, tokenHash: string, expiresAt: Date) {
    const [row] = await db
      .insert(emailVerifications)
      .values({ userId, email, tokenHash, expiresAt })
      .returning();
    return row;
  },

  /** An unconsumed, unexpired claim matching this token. */
  async findActiveByToken(tokenHash: string) {
    const [row] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.tokenHash, tokenHash),
          isNull(emailVerifications.consumedAt),
          gt(emailVerifications.expiresAt, sql`now()`),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /**
   * A claim by token regardless of state — used to tell "already confirmed"
   * apart from "never existed" after the single-use row has been burned.
   */
  async findByToken(tokenHash: string) {
    const [row] = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  },

  /** The user's outstanding claim, if any — drives the "resend / pending" UI. */
  async findActiveForUser(userId: string) {
    const [row] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.userId, userId),
          isNull(emailVerifications.consumedAt),
          gt(emailVerifications.expiresAt, sql`now()`),
        ),
      )
      .orderBy(sql`${emailVerifications.createdAt} desc`)
      .limit(1);
    return row ?? null;
  },

  async markConsumed(id: string) {
    await db
      .update(emailVerifications)
      .set({ consumedAt: sql`now()` })
      .where(eq(emailVerifications.id, id));
  },

  /**
   * Burn every outstanding claim for a user. Called when a new claim is issued
   * so an abandoned older address can't still be confirmed from a stale inbox,
   * and after a successful confirm.
   */
  async consumeAllForUser(userId: string) {
    await db
      .update(emailVerifications)
      .set({ consumedAt: sql`now()` })
      .where(
        and(
          eq(emailVerifications.userId, userId),
          isNull(emailVerifications.consumedAt),
        ),
      );
  },
};

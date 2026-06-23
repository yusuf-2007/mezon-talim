import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { payments } from "../schema";

type Provider = "click" | "payme";
type Status = "pending" | "paid" | "failed" | "refunded";

/**
 * Payments repository. A pending row is created at checkout; its id is the order
 * reference we hand to the provider. Provider callbacks then move it to paid /
 * failed / refunded. `idempotency_key` (unique) guards double-processing of a
 * retried callback; `raw_callback` keeps provider-specific state (e.g. Payme
 * transaction id + timestamps) without a schema change.
 */
export const paymentsRepository = {
  async createPending(input: {
    userId: string;
    courseId: string;
    provider: Provider;
    amountTiyin: number;
  }) {
    const [row] = await db
      .insert(payments)
      .values({
        userId: input.userId,
        courseId: input.courseId,
        provider: input.provider,
        amountTiyin: input.amountTiyin,
        status: "pending",
      })
      .returning();
    return row;
  },

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);
    return row ?? null;
  },

  async findByIdempotencyKey(key: string) {
    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.idempotencyKey, key))
      .limit(1);
    return row ?? null;
  },

  /** Latest reusable pending payment for (user, course, provider), if any. */
  async findReusablePending(userId: string, courseId: string, provider: Provider) {
    const [row] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.userId, userId),
          eq(payments.courseId, courseId),
          eq(payments.provider, provider),
          eq(payments.status, "pending"),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async update(
    id: string,
    patch: Partial<{
      status: Status;
      providerTxnId: string | null;
      idempotencyKey: string | null;
      rawCallback: unknown;
    }>,
  ) {
    const [row] = await db
      .update(payments)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(eq(payments.id, id))
      .returning();
    return row;
  },
};

import "server-only";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../client";
import { courses, payments, users } from "../schema";

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

  /** Admin ledger: all payments (any status) with buyer + course, search/filter. */
  async listAll(
    opts: { search?: string; status?: Status; limit?: number } = {},
  ) {
    const q = opts.search?.trim();
    const conds = [];
    if (opts.status) conds.push(eq(payments.status, opts.status));
    if (q) {
      conds.push(
        or(
          ilike(users.fullName, `%${q}%`),
          ilike(users.email, `%${q}%`),
          ilike(payments.providerTxnId, `%${q}%`),
          sql`${courses.title}->>'uz' ilike ${`%${q}%`}`,
        ),
      );
    }
    return db
      .select({
        id: payments.id,
        amountTiyin: payments.amountTiyin,
        provider: payments.provider,
        status: payments.status,
        providerTxnId: payments.providerTxnId,
        createdAt: payments.createdAt,
        userName: users.fullName,
        userEmail: users.email,
        courseTitle: courses.title,
      })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.userId))
      .innerJoin(courses, eq(courses.id, payments.courseId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(payments.createdAt))
      .limit(opts.limit ?? 200);
  },

  /** Per-status counts + summed amount, for the ledger stat cards. */
  async statusCounts() {
    const rows = await db
      .select({
        status: payments.status,
        count: sql<number>`count(*)`,
        totalTiyin: sql<number>`coalesce(sum(${payments.amountTiyin}), 0)`,
      })
      .from(payments)
      .groupBy(payments.status);
    return rows.map((r) => ({
      status: r.status,
      count: Number(r.count),
      totalTiyin: Number(r.totalTiyin),
    }));
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

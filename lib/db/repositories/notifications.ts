import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../client";
import { notifications, users } from "../schema";

type Channel = "email" | "sms" | "telegram";

export type NotificationInsert = {
  /** Null when the recipient has no account yet (sign-up login codes). */
  userId: string | null;
  channel: Channel;
  type: string; // 'welcome' | 'receipt' | 'certificate' | 'exam_reminder' | ...
  payload?: unknown;
};

/** A terminal outcome reported by the provider after it accepted the message. */
export type DeliveryOutcome = "delivered" | "rejected";

/**
 * Notifications repository — one row per send attempt, for delivery auditing.
 *
 * The row moves queued → sent when the provider accepts it, and then to
 * delivered or rejected when the provider says what actually happened. That
 * second step only arrives by webhook, and may never arrive at all, so `sent`
 * has to be read as "handed over", never as "received".
 */
export const notificationsRepository = {
  async record(input: NotificationInsert) {
    const [row] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        channel: input.channel,
        type: input.type,
        status: "queued",
        payload: (input.payload ?? null) as object | null,
      })
      .returning();
    return row;
  },

  /** Provider accepted the message. `providerMessageId` is how a later
   *  delivery report finds this row again. */
  async markSent(id: string, providerMessageId?: string | null) {
    await db
      .update(notifications)
      .set({
        status: "sent",
        sentAt: new Date(),
        ...(providerMessageId ? { providerMessageId } : {}),
      })
      .where(eq(notifications.id, id));
  },

  async markFailed(id: string) {
    await db
      .update(notifications)
      .set({ status: "failed" })
      .where(eq(notifications.id, id));
  },

  /**
   * Apply a provider's delivery report.
   *
   * Deliberately refuses to move a row that is already `delivered`: providers
   * retry webhooks and can deliver events out of order, and a late "bounced"
   * for a message we know arrived would turn a correct record into a wrong one.
   * `failed` is likewise left alone — our own send threw, so nothing the
   * provider says afterwards is about a message it ever had.
   */
  async recordDeliveryOutcome(
    id: string,
    outcome: DeliveryOutcome,
    providerStatus: string,
  ): Promise<boolean> {
    const rows = await db
      .update(notifications)
      .set({
        status: outcome,
        providerStatus,
        ...(outcome === "delivered" ? { deliveredAt: new Date() } : {}),
      })
      .where(
        sql`${notifications.id} = ${id} and ${notifications.status} not in ('delivered', 'failed')`,
      )
      .returning({ id: notifications.id });
    return rows.length > 0;
  },

  /** Find the row a provider's delivery report refers to. */
  async findByProviderMessageId(providerMessageId: string) {
    const [row] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.providerMessageId, providerMessageId))
      .limit(1);
    return row ?? null;
  },

  /** Has this user already received `type` about `courseId`? (payload.courseId) */
  async existsForCourse(userId: string, type: string, courseId: string) {
    const [row] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        sql`${notifications.userId} = ${userId} and ${notifications.type} = ${type}
            and ${notifications.payload}->>'courseId' = ${courseId}`,
      )
      .limit(1);
    return Boolean(row);
  },

  async listForUser(userId: string) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));
  },

  /**
   * Recent sends with their recipient, newest first — the admin delivery view.
   * Left join, because a sign-up login code has no account behind it yet.
   */
  async listRecentWithRecipient(limit = 100) {
    return db
      .select({
        id: notifications.id,
        channel: notifications.channel,
        type: notifications.type,
        status: notifications.status,
        providerStatus: notifications.providerStatus,
        payload: notifications.payload,
        createdAt: notifications.createdAt,
        sentAt: notifications.sentAt,
        deliveredAt: notifications.deliveredAt,
        recipientName: users.fullName,
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  },

  /** Counts by status over a recent window — the delivery-health summary. */
  /**
   * Rejections in the last `hours`. A burst inside a short window is one
   * gateway incident rather than N unrelated failures, and the admin log says
   * so — but only the database can answer "how many, recently".
   */
  async countRejectedSince(hours: number): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.status, "rejected"),
          gte(notifications.createdAt, sql`now() - make_interval(hours => ${hours})`),
        ),
      );
    return Number(row?.n ?? 0);
  },

  async statusCounts(limit = 500) {
    const recent = db
      .select({ status: notifications.status })
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .as("recent");
    const rows = await db
      .select({ status: recent.status, count: sql<number>`count(*)` })
      .from(recent)
      .groupBy(recent.status);
    return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
  },
};

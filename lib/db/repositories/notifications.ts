import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { notifications } from "../schema";

type Channel = "email" | "sms" | "telegram";

export type NotificationInsert = {
  userId: string;
  channel: Channel;
  type: string; // 'welcome' | 'receipt' | 'certificate' | 'exam_reminder' | ...
  payload?: unknown;
};

/**
 * Notifications repository — one row per send attempt, for delivery auditing.
 * The service records 'queued', then flips to 'sent'/'failed' after dispatch.
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

  async markSent(id: string) {
    await db
      .update(notifications)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(notifications.id, id));
  },

  async markFailed(id: string) {
    await db
      .update(notifications)
      .set({ status: "failed" })
      .where(eq(notifications.id, id));
  },

  async listForUser(userId: string) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));
  },
};
